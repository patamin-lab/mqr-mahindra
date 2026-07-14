/**
 * Tractor IN Sync Service.
 *
 * The single, dedicated path that writes `vehicles`' master-data columns
 * (`model`, `engine_number`, `product_code`, `wh_arrival_date`,
 * `delivery_date`, `dealer_id`, `product_family_id`, `sub_model`) from the
 * Tractor IN Google Sheet. No other module (NTR, PM, any lookup/search
 * route) may write these columns - they only ever read them. This keeps
 * synchronization entirely out of request-time lookups (no read-through
 * upsert), matching the "one synchronization path" requirement.
 *
 * v2.4.0 (Business Decision: "Google Sheet Tractor IN is now the only
 * vehicle master"): every master field the sheet carries is now written on
 * both INSERT and UPDATE, not just on first insert as in v2.3.1 - the
 * sheet is authoritative, so a later correction on the sheet must flow
 * through to an existing `vehicles` row. On UPDATE, a blank sheet cell is
 * never written (same "only set if present" rule already applied to
 * Product Family/Sub Model) - it must never blank out already-known data
 * just because the sheet hasn't caught up yet; INSERT still writes every
 * field unconditionally since there's nothing yet to overwrite. `serial`
 * remains the only conflict/lookup key. PDI Status is read from the sheet
 * but deliberately never written anywhere - it has no `vehicles` column.
 *
 * v2.4.1 (data-quality reporting): `missingProductCode`/
 * `missingWhArrivalDate` on the result report how many processed rows had
 * a blank sheet cell for that field - a data-quality signal about the
 * sheet, never a sync failure/defect. This sync never generates, infers,
 * or backfills a missing value; the fix (if any) happens in the sheet
 * itself, not here.
 *
 * Triggered manually today (`POST /api/admin/tractor-in/sync`,
 * SuperAdmin-gated) since no scheduler platform exists yet in this repo -
 * a scheduled trigger can be added later by calling `sync()`, with no
 * change to this service's shape.
 *
 * v2.3.1 hardening:
 * - A sheet row whose serial has no matching `vehicles` row is now
 *   INSERTed (previously silently skipped - see ADR-012's "Known
 *   limitation" section, now resolved). A row whose serial already
 *   exists is UPDATEd. Never both for the same serial in one run - the
 *   existing-serial set is checked once up front and grown in memory as
 *   rows are inserted, so a duplicate serial within the sheet itself
 *   still only ever inserts once. `vehicles_serial_key` (a DB-level
 *   UNIQUE constraint) is the hard backstop: a same-serial race with
 *   another process surfaces as a unique-violation (Postgres `23505`),
 *   which is treated as `skipped` (the row already exists with the
 *   intended data - not a real failure), never as a duplicate row.
 * - Every synced row (insert or update) stamps `last_synced_at`/
 *   `sync_source = 'tractor_in_sheet'`, independent of whether Product
 *   Family/Sub Model actually changed - this is what makes the health
 *   endpoint's staleness signal meaningful.
 * - A single row's failure (a thrown Supabase error) is caught, counted,
 *   and recorded in `failures` - it never aborts the rest of the run.
 * - Every real (non-dry-run) run's summary is persisted to
 *   `tractor_in_sync_runs` (best effort - a logging failure never turns a
 *   successful sync into a reported failure) and returned to the caller.
 * - `dryRun: true` computes and returns the exact same insert/update/
 *   skip decision per row *without* calling `.insert()`/`.update()` on
 *   `vehicles` at all, and without persisting a run-log row (a dry run
 *   isn't a real sync execution). Because no write is attempted, a dry
 *   run's `failed` count is always 0 - it reports the *planned* action
 *   per row based on current data shape, not runtime failures (a
 *   network blip or constraint violation can only surface during a real
 *   write). This is a deliberate, documented limitation, not a bug.
 *
 * Product Family resolution matches the sheet's `Product Family` text
 * against `product_families.code`/`.name` exactly (case-insensitive,
 * trimmed) - a row whose text doesn't match anything real is reported as
 * unmatched, never silently guessed or auto-created. Dealer resolution
 * (insert only) works the same way against `dealers.id` - the sheet's
 * `Dealer` column already contains dealer codes (e.g. "KTV"), verified
 * live against the real sheet.
 */
import { getSupabase } from '@/lib/supabase';
import { getTractorInRows } from '@/lib/tractorSheet';
import { listActiveProductFamilies, listDealers } from '@/lib/db';
import { normalizeDate } from '@/shared/import/TransformationLibrary';
import { toGregorianYear } from '@/lib/thaiDate';

/** The sheet's date columns mix Gregorian and Buddhist-era years - convert
 *  down to Gregorian whenever the parsed year is implausible for a
 *  Gregorian tractor date, otherwise pass the Gregorian value through
 *  unchanged. Reuses `normalizeDate`'s existing format recognition
 *  (ISO/"DD Mon YYYY"/"DD/MM/YYYY") rather than a second date parser. */
function parseSheetDate(raw: string): string | null {
  const iso = normalizeDate(raw);
  if (!iso) return null;
  const year = Number(iso.slice(0, 4));
  return year > 2200 ? `${toGregorianYear(year)}${iso.slice(4)}` : iso;
}

export interface TractorInSyncUnmatched {
  serial: string;
  productFamilyText: string;
}

export interface TractorInSyncFailure {
  serial: string;
  error: string;
}

export interface TractorInSyncResult {
  dryRun: boolean;
  totalRows: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  unmatchedProductFamily: TractorInSyncUnmatched[];
  failures: TractorInSyncFailure[];
  /** Data-quality signal, not a sync failure: count of processed rows
   *  whose sheet cell for this field is blank. Root cause is always
   *  upstream (Tractor IN Google Sheet), never this sync - see
   *  `DATA_QUALITY_REASON`. */
  missingProductCode: number;
  missingWhArrivalDate: number;
}

/** Static, human-readable root-cause note for `missingProductCode`/
 *  `missingWhArrivalDate` - the sheet cell is blank, this sync never
 *  infers/generates/backfills a value, and a blank cell is intentionally
 *  never treated as a failure (see this file's own "only set if present"
 *  rule for UPDATE). */
export const DATA_QUALITY_REASON = 'Blank in Tractor IN Google Sheet';

export interface TractorInSyncOptions {
  /** Session username, recorded on the run log for audit only. Ignored in dry-run mode (nothing is logged). */
  triggeredBy?: string | null;
  /** When true, computes the same insert/update/skip decisions but never writes to `vehicles` or the run log. */
  dryRun?: boolean;
}

const SYNC_SOURCE = 'tractor_in_sheet';
const UNIQUE_VIOLATION = '23505';

/** Supabase/Postgrest errors are plain objects with a `.message` string,
 *  never `instanceof Error` - checking that shape first (before falling
 *  back to `Error`/`String()`) is required or every DB failure here would
 *  be recorded as the useless literal string "[object Object]". */
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export class TractorInSyncService {
  async sync(options: TractorInSyncOptions = {}): Promise<TractorInSyncResult> {
    const dryRun = options.dryRun ?? false;
    const startedAt = new Date();
    const startMs = Date.now();

    const [rows, families, dealers] = await Promise.all([
      getTractorInRows(),
      listActiveProductFamilies(),
      listDealers(),
    ]);

    const familyIdByKey = new Map<string, string>();
    for (const f of families) {
      familyIdByKey.set(f.code.trim().toLowerCase(), f.id);
      familyIdByKey.set(f.name.trim().toLowerCase(), f.id);
    }
    const dealerIds = new Set(dealers.map((d) => d.id.trim().toUpperCase()));

    const supabase = getSupabase();
    const { data: existingRows, error: existingError } = await supabase.from('vehicles').select('serial');
    if (existingError) throw existingError;
    // Working copy - grown as rows are (or, in dry-run, would be) inserted,
    // so a duplicate serial within the sheet itself is only ever planned
    // as one insert + skip-after in both real and dry-run modes.
    const knownSerials = new Set((existingRows ?? []).map((v: { serial: string }) => v.serial));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let missingProductCode = 0;
    let missingWhArrivalDate = 0;
    const unmatchedProductFamily: TractorInSyncUnmatched[] = [];
    const failures: TractorInSyncFailure[] = [];
    const nowIso = new Date().toISOString();

    for (const row of rows) {
      const serial = row.productSerial.trim();
      if (!serial) {
        skipped += 1;
        continue;
      }

      const productFamilyText = row.productFamily.trim();
      const subModel = row.subModel.trim();

      let productFamilyId: string | null = null;
      if (productFamilyText) {
        productFamilyId = familyIdByKey.get(productFamilyText.toLowerCase()) ?? null;
        if (!productFamilyId) unmatchedProductFamily.push({ serial, productFamilyText });
      }

      const isUpdate = knownSerials.has(serial);

      // Tractor IN is now the sole vehicle master (Business Decision #3) -
      // every master field it carries is written on both insert and
      // update, not just on first insert. PDI Status is deliberately never
      // synced - it has no `vehicles` column and is not part of this
      // platform's data model.
      const dealerText = row.dealer.trim().toUpperCase();
      const dealerId = dealerText && dealerIds.has(dealerText) ? dealerText : null;
      const productCode = row.productCode.trim() || null;
      const whArrivalDate = parseSheetDate(row.whArrivalDate);
      const deliveryDate = parseSheetDate(row.deliveryDateThai);

      // Data-quality signal, computed from the sheet row itself - counted
      // once per processed row regardless of dry-run/real, insert/update,
      // or write outcome. Never a sync failure (see DATA_QUALITY_REASON).
      if (!productCode) missingProductCode += 1;
      if (!whArrivalDate) missingWhArrivalDate += 1;

      if (dryRun) {
        if (isUpdate) updated += 1;
        else {
          inserted += 1;
          knownSerials.add(serial);
        }
        continue;
      }

      const masterFields: Record<string, string | null> = {
        model: row.productModel.trim() || null,
        engine_number: row.engineSerial.trim() || null,
        product_code: productCode,
        wh_arrival_date: whArrivalDate,
        delivery_date: deliveryDate,
        dealer_id: dealerId,
      };

      try {
        if (isUpdate) {
          // A blank sheet cell must never blank out already-known data on
          // an existing vehicle (same "only set if present" rule this file
          // already applied to Product Family/Sub Model) - only insert
          // writes every field unconditionally, since there's nothing yet
          // to overwrite.
          const updatePayload: Record<string, string> = {
            last_synced_at: nowIso,
            sync_source: SYNC_SOURCE,
          };
          for (const [key, value] of Object.entries(masterFields)) {
            if (value) updatePayload[key] = value;
          }
          if (productFamilyId) updatePayload.product_family_id = productFamilyId;
          if (subModel) updatePayload.sub_model = subModel;

          const { error } = await supabase.from('vehicles').update(updatePayload).eq('serial', serial);
          if (error) throw error;
          updated += 1;
        } else {
          const { error } = await supabase.from('vehicles').insert({
            serial,
            ...masterFields,
            product_family_id: productFamilyId,
            sub_model: subModel || null,
            last_synced_at: nowIso,
            sync_source: SYNC_SOURCE,
          });
          if (error) {
            if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
              // Another process inserted this exact serial between our
              // existence check and this insert (or the sheet itself has
              // a duplicate serial row) - the row now exists, so this is
              // not a failure, and we must never attempt a second insert.
              skipped += 1;
              knownSerials.add(serial);
              continue;
            }
            throw error;
          }
          inserted += 1;
          knownSerials.add(serial);
        }
      } catch (err) {
        failed += 1;
        failures.push({ serial, error: extractErrorMessage(err) });
      }
    }

    const finishedAt = new Date();
    const durationMs = Date.now() - startMs;
    const result: TractorInSyncResult = {
      dryRun,
      totalRows: rows.length,
      inserted,
      updated,
      skipped,
      failed,
      durationMs,
      unmatchedProductFamily,
      failures,
      missingProductCode,
      missingWhArrivalDate,
    };

    if (!dryRun) await this.recordRun(startedAt, finishedAt, result, options.triggeredBy ?? null);
    return result;
  }

  /** Best-effort: the run log is observability data, not the source of
   *  truth for `vehicles` - a failure to persist it must never turn an
   *  otherwise-successful sync into a reported failure. Never called for
   *  a dry run - it isn't a real sync execution. */
  private async recordRun(startedAt: Date, finishedAt: Date, result: TractorInSyncResult, triggeredBy: string | null): Promise<void> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from('tractor_in_sync_runs').insert({
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: result.durationMs,
        total_rows: result.totalRows,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        status: result.failed > 0 ? 'partial_failure' : 'success',
        unmatched_product_family: result.unmatchedProductFamily,
        failures: result.failures,
        missing_product_code: result.missingProductCode,
        missing_wh_arrival_date: result.missingWhArrivalDate,
        triggered_by: triggeredBy,
      });
      if (error) console.error('Failed to record Tractor IN sync run', error);
    } catch (err) {
      console.error('Failed to record Tractor IN sync run', err);
    }
  }
}

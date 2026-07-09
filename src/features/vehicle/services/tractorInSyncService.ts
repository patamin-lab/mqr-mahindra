/**
 * Tractor IN Sync Service.
 *
 * The single, dedicated path that writes `vehicles.product_family_id`/
 * `sub_model` (and, since v2.3.1, the row itself) from the Tractor IN
 * Google Sheet. No other module (NTR, PM, any lookup/search route) may
 * write these columns - they only ever read them. This keeps
 * synchronization entirely out of request-time lookups (no read-through
 * upsert), matching the "one synchronization path" requirement.
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
}

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

      if (dryRun) {
        if (isUpdate) updated += 1;
        else {
          inserted += 1;
          knownSerials.add(serial);
        }
        continue;
      }

      try {
        if (isUpdate) {
          const updatePayload: Record<string, string> = {
            last_synced_at: nowIso,
            sync_source: SYNC_SOURCE,
          };
          if (productFamilyId) updatePayload.product_family_id = productFamilyId;
          if (subModel) updatePayload.sub_model = subModel;

          const { error } = await supabase.from('vehicles').update(updatePayload).eq('serial', serial);
          if (error) throw error;
          updated += 1;
        } else {
          const dealerText = row.dealer.trim().toUpperCase();
          const dealerId = dealerText && dealerIds.has(dealerText) ? dealerText : null;

          const { error } = await supabase.from('vehicles').insert({
            serial,
            model: row.productModel.trim() || null,
            engine_number: row.engineSerial.trim() || null,
            dealer_id: dealerId,
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
        triggered_by: triggeredBy,
      });
      if (error) console.error('Failed to record Tractor IN sync run', error);
    } catch (err) {
      console.error('Failed to record Tractor IN sync run', err);
    }
  }
}

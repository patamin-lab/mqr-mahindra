/**
 * NTR — Legacy Import service.
 *
 * Orchestrates the Legacy Import workflow: Upload -> Validation -> Preview
 * -> Import -> Summary -> Audit. Never inserts into Supabase directly -
 * every write goes through `NtrService`/`SupabaseNtrRepository` (NTR
 * records) and `createVehicleManual()` (tractors), the exact same paths
 * the manual registration flow uses, so a legacy-imported record is
 * indistinguishable in shape from a manually-created one except for
 * `source='legacy_import'` and `import_session_id`.
 *
 * Nothing is written until `commit()` is explicitly called - `preview()`
 * only parses and validates. `commit()` re-parses and re-validates the
 * stored original file itself (fetched from its Drive URL) rather than
 * trusting any client-echoed row data from the preview step, so a
 * tampered request body can't smuggle different rows into the actual
 * import than what was shown in the preview.
 */
import { getVehicleBySerial, createVehicleManual, getDealer } from '@/lib/db';
import { logAuditEvent } from '@/lib/db';
import { NtrService } from './ntrService';
import { NtrRepository } from '../repositories/ntrRepository';
import { NtrImportSessionRepository } from '../repositories/ntrImportSessionRepository';
import { parseNtrImportFile } from './ntrImportParser';
import {
  NtrImportPreview,
  NtrImportRow,
  NtrImportRowOutcome,
  NtrImportRowResult,
  NtrImportSession,
  NtrRecordCreateInput,
} from '../types';

export interface NtrImportActor {
  username: string;
}

function isBlankRow(row: NtrImportRow): boolean {
  return !row.dealer_id && !row.serial && !row.customer_name && !row.customer_phone && !row.delivery_date;
}

interface ValidatedRow {
  row: NtrImportRow;
  outcome: NtrImportRowOutcome;
  reason?: string;
}

async function validateRows(rows: NtrImportRow[], ntrRepository: NtrRepository): Promise<ValidatedRow[]> {
  const results: ValidatedRow[] = [];
  for (const row of rows) {
    if (isBlankRow(row)) {
      results.push({ row, outcome: 'skipped', reason: 'Empty row' });
      continue;
    }
    if (!row.dealer_id) {
      results.push({ row, outcome: 'failed', reason: 'Missing dealer_id' });
      continue;
    }
    if (!row.serial) {
      results.push({ row, outcome: 'failed', reason: 'Missing serial' });
      continue;
    }
    if (!row.engine_number) {
      results.push({ row, outcome: 'failed', reason: 'Missing engine_number' });
      continue;
    }
    if (!row.delivery_date) {
      results.push({ row, outcome: 'failed', reason: 'Missing delivery_date' });
      continue;
    }
    // customer_name is required unless a structured name (title/first/
    // last) is provided instead - NtrService.create() composes it, same
    // rule the manual registration form uses (see
    // docs/standards/NTR_IMPORT_MANUAL.md).
    const hasName = row.customer_name || row.customer_first_name || row.customer_last_name;
    if (!hasName || !row.customer_phone) {
      results.push({ row, outcome: 'failed', reason: 'Missing customer name (or title/first/last name) or customer_phone' });
      continue;
    }
    const dealer = await getDealer(row.dealer_id);
    if (!dealer) {
      results.push({ row, outcome: 'failed', reason: `Unknown dealer_id "${row.dealer_id}"` });
      continue;
    }
    const existingNtr = await ntrRepository.findActiveBySerial(row.serial);
    if (existingNtr) {
      results.push({ row, outcome: 'duplicate', reason: `Already registered as ${existingNtr.ntr_number}` });
      continue;
    }
    results.push({ row, outcome: 'valid' });
  }
  return results;
}

function toPreview(validated: ValidatedRow[]): NtrImportPreview {
  const rows: NtrImportRowResult[] = validated.map((v) => ({ row: v.row.row, serial: v.row.serial || null, outcome: v.outcome, reason: v.reason }));
  return {
    totalRecords: validated.length,
    validCount: validated.filter((v) => v.outcome === 'valid').length,
    duplicateCount: validated.filter((v) => v.outcome === 'duplicate').length,
    skippedCount: validated.filter((v) => v.outcome === 'skipped').length,
    failedCount: validated.filter((v) => v.outcome === 'failed').length,
    rows,
  };
}

export class NtrImportService {
  constructor(
    private readonly ntrService: NtrService,
    private readonly ntrRepository: NtrRepository,
    private readonly sessionRepository: NtrImportSessionRepository
  ) {}

  /** Parses + validates only - writes exactly one row (the session
   *  itself, status='Pending') so the Import Audit view has a record of
   *  every attempt, including ones never committed. */
  async preview(
    fileBuffer: Buffer,
    filename: string,
    originalFileUrl: string | null,
    actor: NtrImportActor
  ): Promise<{ session: NtrImportSession; preview: NtrImportPreview }> {
    const rows = await parseNtrImportFile(fileBuffer, filename);
    const validated = await validateRows(rows, this.ntrRepository);
    const preview = toPreview(validated);

    const session = await this.sessionRepository.create(
      { importer: actor.username, filename, originalFileUrl, totalRecords: preview.totalRecords },
      actor
    );
    await this.sessionRepository.update(
      session.id,
      {
        validCount: preview.validCount,
        duplicateCount: preview.duplicateCount,
        skippedCount: preview.skippedCount,
        failedCount: preview.failedCount,
        errors: preview.rows.filter((r) => r.outcome === 'failed').map((r) => ({ row: r.row, serial: r.serial, reason: r.reason ?? '' })),
      },
      actor
    );

    return { session, preview };
  }

  /** Re-fetches and re-parses the original file from its stored URL -
   *  never trusts client-supplied row data - then writes exactly the rows
   *  that re-validate as 'valid' (a row that changed between preview and
   *  commit, e.g. someone else registered the same serial in the
   *  meantime, is re-classified rather than blindly imported). */
  async commit(sessionId: string, actor: NtrImportActor): Promise<NtrImportSession> {
    const session = await this.sessionRepository.getById(sessionId);
    if (!session) {
      throw new Error('Import session not found');
    }
    if (!session.original_file_url) {
      throw new Error('Import session has no stored file to commit');
    }

    const fileRes = await fetch(session.original_file_url);
    if (!fileRes.ok) {
      throw new Error('Failed to re-fetch the original import file');
    }
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const rows = await parseNtrImportFile(buffer, session.filename);
    const validated = await validateRows(rows, this.ntrRepository);

    let imported = 0;
    let failed = 0;
    const errors: { row: number; serial: string | null; reason: string }[] = validated
      .filter((v) => v.outcome === 'failed')
      .map((v) => ({ row: v.row.row, serial: v.row.serial || null, reason: v.reason ?? '' }));

    for (const v of validated) {
      if (v.outcome !== 'valid') continue;
      try {
        let vehicle = await getVehicleBySerial(v.row.serial, null);
        if (!vehicle) {
          vehicle = await createVehicleManual({
            serial: v.row.serial,
            model: v.row.model,
            engineNumber: v.row.engine_number,
            dealerId: v.row.dealer_id,
            branchId: v.row.branch_id,
            deliveryDate: v.row.delivery_date,
            importSessionId: session.id,
          });
        }

        const input: NtrRecordCreateInput = {
          dealer_id: v.row.dealer_id,
          branch_id: v.row.branch_id,
          serial: v.row.serial,
          model: v.row.model ?? vehicle.model,
          engine_number: v.row.engine_number ?? vehicle.engine_number ?? null,
          salesperson: v.row.salesperson,
          receiving_person: v.row.receiving_person,
          customer_title: v.row.customer_title,
          customer_first_name: v.row.customer_first_name,
          customer_last_name: v.row.customer_last_name,
          customer_name: v.row.customer_name,
          customer_phone: v.row.customer_phone,
          customer_address: v.row.customer_address,
          customer_subdistrict: v.row.customer_subdistrict,
          customer_district: v.row.customer_district,
          customer_province: v.row.customer_province,
          customer_postal_code: v.row.customer_postal_code,
          customer_type: v.row.customer_type,
          product_family_id: v.row.product_family_id,
          variant: v.row.variant,
          retail_date: v.row.retail_date,
          delivery_date: v.row.delivery_date,
          pdi_date: v.row.pdi_date,
          manufacturing_year: v.row.manufacturing_year,
          hour_meter: v.row.hour_meter,
          photo_customer_tractor_url: null,
          photo_serial_plate_url: null,
          photo_hour_meter_url: null,
          photo_signed_document_url: null,
          video_url: null,
          audio_url: null,
          source: 'legacy_import',
          import_session_id: session.id,
        };
        await this.ntrService.create(input, actor);
        imported++;
      } catch (err) {
        failed++;
        errors.push({ row: v.row.row, serial: v.row.serial || null, reason: err instanceof Error ? err.message : 'Import failed' });
      }
    }

    const completed = await this.sessionRepository.update(
      session.id,
      {
        status: 'Completed',
        validCount: imported,
        duplicateCount: validated.filter((v) => v.outcome === 'duplicate').length,
        skippedCount: validated.filter((v) => v.outcome === 'skipped').length,
        failedCount: failed + validated.filter((v) => v.outcome === 'failed').length,
        errors,
        completedAt: new Date().toISOString(),
      },
      actor
    );

    await logAuditEvent({
      module: 'ntr',
      recordId: session.id,
      recordRef: session.filename,
      eventType: 'SystemEvent',
      fieldName: 'legacy_import',
      newValue: JSON.stringify({ importer: actor.username, filename: session.filename, imported, failed, sessionId: session.id }),
      performedBy: actor.username,
    });

    return completed;
  }

  async listSessions(): Promise<NtrImportSession[]> {
    return this.sessionRepository.list();
  }
}

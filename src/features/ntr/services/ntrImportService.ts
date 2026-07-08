/**
 * NTR — Legacy Import service.
 *
 * Orchestrates the Legacy Import pipeline: Upload -> Parse -> Business
 * Validation -> Duplicate Detection -> Preview -> User Confirmation ->
 * Commit (single DB transaction per row) -> Archive Pending -> Background
 * Archive -> Archived. See docs/adr/ADR-008-Google-Drive-Decoupling.md.
 *
 * Google Drive is no longer part of the critical path: `preview()` stores
 * the uploaded file's bytes in Postgres (`ntr_import_sessions.file_content`,
 * base64) instead of uploading to Drive, and `commit()` re-parses from that
 * stored copy - never trusting client-echoed row data, exactly as before,
 * just reading from Postgres instead of re-fetching a Drive URL. A
 * successful import (`status='Imported'`) no longer depends on Drive being
 * reachable at all. Archiving to Drive happens afterward, via
 * `archiveSession()`/`processArchiveQueue()`, and a Drive failure only ever
 * flips the session to 'Archive Failed' (retryable) - it can never undo an
 * already-committed import.
 *
 * Nothing is written to `ntr_records`/`vehicles` until `commit()` is
 * explicitly called - `preview()` only parses and validates.
 */
import type ExcelJS from 'exceljs';
import { logAuditEvent } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { Dealer, Vehicle, Branch } from '@/lib/types';
import { uploadFileToDrive } from '@/lib/googleDrive';
import { ColumnMappingResult, ImportWarning, formatImportError } from '@/shared/import';
import { NtrRepository } from '../repositories/ntrRepository';
import { NtrImportSessionRepository } from '../repositories/ntrImportSessionRepository';
import { mapNtrImportHeaders, parseNtrImportFile } from './ntrImportParser';
import { buildNtrImportResultWorkbook } from './ntrImportResultExcel';
import { NTR_IMPORT_FIELDS } from './ntrImportFields';
import { MasterDataService } from '@/shared/master-data';
import {
  NtrImportMode,
  NtrImportPreview,
  NtrImportRow,
  NtrImportRowOutcome,
  NtrImportRowResult,
  NtrImportSession,
  NtrRecordCreateInput,
} from '../types';

/** Canonical field key -> business-facing column name, for
 *  `formatImportError()` to mention in a rewritten message (e.g.
 *  `dealer_id` -> "Dealer Code"). */
const NTR_ERROR_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  NTR_IMPORT_FIELDS.map((f) => [f.canonicalKey, f.displayLabel])
);

function humanize(reason: string | undefined): string | undefined {
  return reason === undefined ? undefined : formatImportError(reason, { fieldLabels: NTR_ERROR_FIELD_LABELS });
}

export interface NtrImportActor {
  username: string;
}

function isBlankRow(row: NtrImportRow): boolean {
  return !row.dealer_id && !row.serial && !row.customer_name && !row.customer_phone && !row.delivery_date;
}

/** Plausibility check only - this is not a lookup, and it never talks to
 *  the database. Used solely to decide, in Legacy Import Mode, whether an
 *  unrecognized serial is "a real serial for a pre-system tractor" (passes,
 *  proceeds with a warning) vs. obvious junk/typo (fails outright, same as
 *  Strict Mode would). Deliberately permissive - real dealer serials seen
 *  in this codebase's own sample data include letters, digits, and
 *  hyphens with no fixed length, so this only rejects what's clearly not
 *  a serial at all (empty, or containing characters no serial has ever
 *  used, or unreasonably short/long). */
function isPlausibleSerialFormat(serial: string): boolean {
  return /^[A-Za-z0-9-]{3,50}$/.test(serial.trim());
}

function normalizeForDuplicateCompare(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/** Retail Date's own validity, independent of duplicate/serial checks:
 *  never a future date, and never before the tractor's Manufacturing
 *  Year (only the year is captured on this template, not a full
 *  manufacturing date - so "before Manufacturing Date" is checked at
 *  year granularity). There is no Invoice Date field anywhere in this
 *  schema or template, so "before Invoice Date" has nothing to check
 *  against - not implemented, not silently faked; see
 *  docs/import/NTR_HISTORICAL_IMPORT.md's Date Validation section.
 *  "Duplicate Retail Date for the same tractor" is not a separate check
 *  here - a second row for the same serial is already caught by the
 *  duplicate-serial checks below (in-file and against `ntr_records`)
 *  before this function would ever see two dates for one tractor. */
function validateNtrDates(row: NtrImportRow): string | null {
  if (row.retail_date) {
    if (row.retail_date > TODAY_ISO()) return `Retail Date "${row.retail_date}" cannot be in the future`;
    if (row.manufacturing_year) {
      const retailYear = Number(row.retail_date.slice(0, 4));
      if (retailYear < row.manufacturing_year) {
        return `Retail Date "${row.retail_date}" is before Manufacturing Year ${row.manufacturing_year}`;
      }
    }
  }
  return null;
}

interface ValidatedRow {
  row: NtrImportRow;
  outcome: NtrImportRowOutcome;
  reason?: string;
  warning?: string;
}

/** `.in(column, values)` builds a GET request with every value in the URL
 *  query string - a 10,000-distinct-value file sent as one query hits
 *  Cloudflare's "414 Request-URI Too Large" in front of Supabase (a real
 *  regression found via live 10,000-row UAT immediately after the bulk-
 *  prefetch performance fix below). Chunking keeps each request's URL a
 *  safe length while still being a small, fixed number of round trips
 *  (run in parallel), not one per row. */
const BULK_QUERY_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Bulk dealer-existence check, a small fixed number of chunked queries
 *  for every distinct `dealer_id` in the file - see the module doc
 *  comment on `findActiveBySerials()` for why this replaces a per-row
 *  `getDealer()` call. Keyed exactly by the dealer_id string passed in
 *  (this table's ids aren't case-normalized anywhere else in the app, so
 *  neither is this). */
async function fetchDealersByIds(dealerIds: string[]): Promise<Map<string, Dealer>> {
  if (dealerIds.length === 0) return new Map();
  const results = await Promise.all(
    chunk(dealerIds, BULK_QUERY_CHUNK_SIZE).map(async (batch) => {
      const { data, error } = await getSupabase().from('dealers').select('*').in('id', batch);
      if (error) throw error;
      return data as Dealer[];
    })
  );
  return new Map(results.flat().map((d) => [d.id, d]));
}

/** Bulk branch lookup, chunked the same way as `fetchDealersByIds()` -
 *  Dealer/Branch Scope Platform Standard: a row's `branch_id` (when
 *  present) must actually belong to that row's `dealer_id`, the same
 *  dealer-relationship check `assertBranchAccess()` does elsewhere,
 *  applied here in bulk instead of per-row for the 10,000-row
 *  performance budget (see `fetchDealersByIds()`'s own comment - this
 *  file previously had zero validation of `branch_id` at all, letting a
 *  malformed/cross-dealer branch_id from the uploaded file silently land
 *  in `ntr_records`, invisible or mis-scoped for a branch-pinned
 *  DealerUser later). */
async function fetchBranchesByIds(branchIds: string[]): Promise<Map<string, Branch>> {
  if (branchIds.length === 0) return new Map();
  const results = await Promise.all(
    chunk(branchIds, BULK_QUERY_CHUNK_SIZE).map(async (batch) => {
      const { data, error } = await getSupabase().from('branches').select('*').in('id', batch);
      if (error) throw error;
      return data as Branch[];
    })
  );
  return new Map(results.flat().map((b) => [b.id, b]));
}

/** Bulk Tractor-serial lookup, chunked the same way as
 *  `fetchDealersByIds()` and for the same reason. */
async function fetchVehiclesBySerials(serials: string[]): Promise<Map<string, Vehicle>> {
  if (serials.length === 0) return new Map();
  const results = await Promise.all(
    chunk(serials, BULK_QUERY_CHUNK_SIZE).map(async (batch) => {
      const { data, error } = await getSupabase().from('vehicles').select('*').in('serial', batch);
      if (error) throw error;
      return data as Vehicle[];
    })
  );
  return new Map(results.flat().map((v) => [v.serial, v]));
}

async function validateRows(rows: NtrImportRow[], ntrRepository: NtrRepository, mode: NtrImportMode): Promise<ValidatedRow[]> {
  const results: ValidatedRow[] = [];
  // In-file duplicate tracking - "Duplicate inside import file" (serial,
  // hard reject) and the warning-only phone/customer-name duplicates are
  // both scoped to *this* file only, never a database-wide scan - keeps
  // the 10,000-row performance target achievable without a per-row query.
  const seenSerials = new Map<string, number>();
  const seenPhones = new Map<string, number>();
  const seenNames = new Map<string, number>();

  // Bulk-prefetch every dealer/vehicle/existing-NTR this file could
  // possibly reference, ONCE, before the per-row loop below - a
  // 10,000-row file previously ran 10,000+ sequential single-row Supabase
  // queries here (one each for dealer, vehicle, and existing-NTR lookups),
  // taking roughly 10 minutes end to end - a real, confirmed performance
  // defect found via live UAT, well past any usable request timeout
  // (Vercel serverless functions cap far below that). Distinct ids/serials
  // only, and blank values filtered out - a row with a missing dealer_id/
  // serial already fails earlier in this same function, before ever
  // needing a lookup.
  const distinctDealerIds = [...new Set(rows.map((r) => r.dealer_id).filter(Boolean))];
  const distinctBranchIds = [...new Set(rows.map((r) => r.branch_id).filter((v): v is string => !!v))];
  const distinctSerials = [...new Set(rows.map((r) => r.serial).filter(Boolean))];
  const [dealersById, branchesById, vehiclesBySerial, activeNtrBySerial] = await Promise.all([
    fetchDealersByIds(distinctDealerIds),
    fetchBranchesByIds(distinctBranchIds),
    fetchVehiclesBySerials(distinctSerials),
    ntrRepository.findActiveBySerials(distinctSerials),
  ]);

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
    if (!row.model) {
      results.push({ row, outcome: 'failed', reason: 'Missing model' });
      continue;
    }
    if (!row.delivery_date) {
      results.push({ row, outcome: 'failed', reason: 'Missing delivery_date' });
      continue;
    }
    if (!row.retail_date) {
      results.push({ row, outcome: 'failed', reason: 'Missing retail_date' });
      continue;
    }
    if (row.hour_meter === null || row.hour_meter === undefined) {
      results.push({ row, outcome: 'failed', reason: 'Missing hour_meter' });
      continue;
    }
    if (!row.customer_title) {
      results.push({ row, outcome: 'failed', reason: 'Missing customer_title' });
      continue;
    }
    if (!row.customer_first_name) {
      results.push({ row, outcome: 'failed', reason: 'Missing customer_first_name' });
      continue;
    }
    if (!row.customer_last_name) {
      results.push({ row, outcome: 'failed', reason: 'Missing customer_last_name' });
      continue;
    }
    if (!row.customer_phone) {
      results.push({ row, outcome: 'failed', reason: 'Missing customer_phone' });
      continue;
    }
    if (!row.customer_address) {
      results.push({ row, outcome: 'failed', reason: 'Missing customer_address' });
      continue;
    }
    if (!row.customer_province) {
      results.push({ row, outcome: 'failed', reason: 'Missing customer_province' });
      continue;
    }
    if (!row.customer_district) {
      results.push({ row, outcome: 'failed', reason: 'Missing customer_district' });
      continue;
    }
    if (!row.customer_subdistrict) {
      results.push({ row, outcome: 'failed', reason: 'Missing customer_subdistrict' });
      continue;
    }

    const dateError = validateNtrDates(row);
    if (dateError) {
      results.push({ row, outcome: 'failed', reason: dateError });
      continue;
    }

    const address = await MasterDataService.validateThaiAddress({
      province: row.customer_province,
      district: row.customer_district,
      subdistrict: row.customer_subdistrict,
      postalCode: row.customer_postal_code,
    });
    if (!address.ok) {
      results.push({ row, outcome: 'failed', reason: address.reason });
      continue;
    }

    const serialKey = normalizeForDuplicateCompare(row.serial);
    const priorSerialRow = seenSerials.get(serialKey);
    if (priorSerialRow !== undefined) {
      results.push({ row, outcome: 'duplicate', reason: `Duplicate Product Serial Number - already used on row ${priorSerialRow} in this file` });
      continue;
    }

    const dealer = dealersById.get(row.dealer_id);
    if (!dealer) {
      results.push({ row, outcome: 'failed', reason: `Unknown dealer_id "${row.dealer_id}"` });
      continue;
    }
    // Dealer/Branch Scope Platform Standard: branch_id is optional in the
    // import file, but when present it must actually belong to this row's
    // dealer_id - otherwise the imported record would land with a
    // cross-dealer branch_id, invisible or mis-scoped for a branch-pinned
    // DealerUser later.
    if (row.branch_id) {
      const branch = branchesById.get(row.branch_id);
      if (!branch || branch.dealer_id !== row.dealer_id) {
        results.push({ row, outcome: 'failed', reason: `branch_id "${row.branch_id}" does not belong to dealer_id "${row.dealer_id}"` });
        continue;
      }
    }
    const existingNtr = activeNtrBySerial.get(row.serial);
    if (existingNtr) {
      results.push({ row, outcome: 'duplicate', reason: `Duplicate NTR - already registered as ${existingNtr.ntr_number}` });
      continue;
    }

    // Serial Number validation - see NtrImportMode's own doc comment.
    let warning: string | undefined;
    const existingVehicle = vehiclesBySerial.get(row.serial);
    if (!existingVehicle) {
      if (mode === 'strict') {
        results.push({ row, outcome: 'failed', reason: 'Unknown Product Serial Number' });
        continue;
      }
      if (!isPlausibleSerialFormat(row.serial)) {
        results.push({ row, outcome: 'failed', reason: `Serial Number "${row.serial}" is not a plausible format` });
        continue;
      }
      warning = 'New Tractor record was created automatically from historical import.';
    } else if (row.model && existingVehicle.model && normalizeForDuplicateCompare(row.model) !== normalizeForDuplicateCompare(existingVehicle.model)) {
      warning = `Model "${row.model}" does not match the existing Tractor record's Model "${existingVehicle.model}"`;
    }

    // Warning-only duplicates - never block import, per the milestone's
    // own "Warnings must never block import." Checked last so a row that
    // already failed/duplicated above never also reports a spurious
    // phone/name warning on top of its real outcome.
    const phoneKey = normalizeForDuplicateCompare(row.customer_phone);
    const priorPhoneRow = seenPhones.get(phoneKey);
    if (priorPhoneRow !== undefined) {
      warning = warning
        ? `${warning}; Duplicate Customer Phone (also on row ${priorPhoneRow})`
        : `Duplicate Customer Phone - also used on row ${priorPhoneRow} in this file`;
    }
    const nameKey = normalizeForDuplicateCompare(row.customer_name || `${row.customer_first_name ?? ''} ${row.customer_last_name ?? ''}`);
    const priorNameRow = seenNames.get(nameKey);
    if (priorNameRow !== undefined) {
      warning = warning
        ? `${warning}; Duplicate Customer Name (also on row ${priorNameRow})`
        : `Duplicate Customer Name - also used on row ${priorNameRow} in this file`;
    }

    seenSerials.set(serialKey, row.row);
    seenPhones.set(phoneKey, row.row);
    seenNames.set(nameKey, row.row);

    results.push({ row, outcome: 'valid', warning });
  }
  return results;
}

function toPreview(validated: ValidatedRow[], columnMapping: ColumnMappingResult, importMode: NtrImportMode, executionTimeMs: number): NtrImportPreview {
  const rows: NtrImportRowResult[] = validated.map((v) => ({
    row: v.row.row,
    serial: v.row.serial || null,
    outcome: v.outcome,
    reason: humanize(v.reason),
  }));
  const warnings: ImportWarning[] = validated
    .filter((v): v is ValidatedRow & { warning: string } => !!v.warning)
    .map((v) => ({ row: v.row.row, reference: v.row.serial || null, message: v.warning }));
  return {
    totalRecords: validated.length,
    validCount: validated.filter((v) => v.outcome === 'valid').length,
    duplicateCount: validated.filter((v) => v.outcome === 'duplicate').length,
    skippedCount: validated.filter((v) => v.outcome === 'skipped').length,
    failedCount: validated.filter((v) => v.outcome === 'failed').length,
    rows,
    columnMapping,
    warnings,
    executionTimeMs,
    importMode,
  };
}

async function sha256Hex(buffer: Buffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class NtrImportService {
  constructor(
    private readonly ntrRepository: NtrRepository,
    private readonly sessionRepository: NtrImportSessionRepository
  ) {}

  /** Parses + validates only - writes exactly one row (the session
   *  itself, status='Validated') so the Import Audit view has a record of
   *  every attempt, including ones never committed. The uploaded file's
   *  bytes are stored in Postgres (base64), not Drive - Drive is never
   *  touched until archiving, well after a successful commit. */
  async preview(
    fileBuffer: Buffer,
    filename: string,
    actor: NtrImportActor,
    importMode: NtrImportMode = 'legacy'
  ): Promise<{ session: NtrImportSession; preview: NtrImportPreview }> {
    const startedAt = Date.now();
    const rows = await parseNtrImportFile(fileBuffer, filename);
    const validated = await validateRows(rows, this.ntrRepository, importMode);
    const columnMapping = await mapNtrImportHeaders(fileBuffer, filename);
    const preview = toPreview(validated, columnMapping, importMode, Date.now() - startedAt);
    const checksum = await sha256Hex(fileBuffer);

    const session = await this.sessionRepository.create(
      { importer: actor.username, filename, fileContent: fileBuffer.toString('base64'), fileChecksum: checksum, totalRecords: preview.totalRecords },
      actor
    );
    const validatedSession = await this.sessionRepository.update(
      session.id,
      {
        status: 'Validated',
        validCount: preview.validCount,
        duplicateCount: preview.duplicateCount,
        skippedCount: preview.skippedCount,
        failedCount: preview.failedCount,
        errors: preview.rows.filter((r) => r.outcome === 'failed').map((r) => ({ row: r.row, serial: r.serial, reason: r.reason ?? '' })),
      },
      actor
    );

    return { session: validatedSession, preview };
  }

  /** Re-parses the file from its stored bytes (`file_content`) - never
   *  trusts client-supplied row data - then commits exactly the rows that
   *  re-validate as 'valid', one atomic database transaction per row (see
   *  `NtrRepository.commitLegacyImportRow()` / `commit_ntr_legacy_import_row`).
   *  A row that changed between preview and commit (e.g. someone else
   *  registered the same serial in the meantime) is re-classified rather
   *  than blindly imported. On success, queues the session for background
   *  archiving - Drive is never called from this method. */
  async commit(sessionId: string, actor: NtrImportActor, importMode: NtrImportMode = 'legacy'): Promise<NtrImportSession> {
    const session = await this.sessionRepository.getById(sessionId);
    if (!session) {
      throw new Error('Import session not found');
    }
    if (!session.file_content) {
      throw new Error('Import session has no stored file to commit');
    }

    const buffer = Buffer.from(session.file_content, 'base64');
    const rows = await parseNtrImportFile(buffer, session.filename);
    const validated = await validateRows(rows, this.ntrRepository, importMode);

    let imported = 0;
    let failed = 0;
    const errors: { row: number; serial: string | null; reason: string }[] = validated
      .filter((v) => v.outcome === 'failed')
      .map((v) => ({ row: v.row.row, serial: v.row.serial || null, reason: humanize(v.reason) ?? '' }));

    for (const v of validated) {
      if (v.outcome !== 'valid') continue;
      try {
        const input: NtrRecordCreateInput = {
          dealer_id: v.row.dealer_id,
          branch_id: v.row.branch_id,
          serial: v.row.serial,
          model: v.row.model,
          engine_number: v.row.engine_number,
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
          pdi_number: v.row.pdi_number,
          manufacturing_year: v.row.manufacturing_year,
          hour_meter: v.row.hour_meter,
          photo_customer_id_url: null,
          photo_customer_tractor_url: null,
          photo_serial_plate_url: null,
          photo_hour_meter_url: null,
          photo_signed_document_url: null,
          video_url: null,
          audio_url: null,
          source: 'legacy_import',
          import_session_id: session.id,
        };
        await this.ntrRepository.commitLegacyImportRow(
          session.id,
          {
            model: v.row.model,
            engineNumber: v.row.engine_number,
            dealerId: v.row.dealer_id,
            branchId: v.row.branch_id,
            deliveryDate: v.row.delivery_date,
          },
          input,
          actor
        );
        imported++;
      } catch (err) {
        failed++;
        const reason = err instanceof Error ? err.message : 'Import failed';
        errors.push({ row: v.row.row, serial: v.row.serial || null, reason: humanize(reason) ?? reason });
      }
    }

    const now = new Date().toISOString();
    await this.sessionRepository.update(
      session.id,
      {
        status: 'Imported',
        validCount: imported,
        duplicateCount: validated.filter((v) => v.outcome === 'duplicate').length,
        skippedCount: validated.filter((v) => v.outcome === 'skipped').length,
        failedCount: failed + validated.filter((v) => v.outcome === 'failed').length,
        errors,
        completedAt: now,
        importedAt: now,
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

    // Queue for archive - a Drive failure here must never undo the import
    // that already committed above, so this is a separate, best-effort
    // status transition, not part of the transaction that just succeeded.
    return this.sessionRepository.update(session.id, { status: 'Archive Pending' }, actor);
  }

  /** `NTR_IMPORT_RESULT.xlsx` - re-parses and re-validates from the
   *  session's stored file (same non-trusting approach as `commit()`),
   *  never from a client-supplied row list, so the downloaded report
   *  always reflects a real, reproducible validation pass. `importMode`
   *  is not persisted on the session (see `NtrImportMode`'s doc comment)
   *  - the caller must pass whichever mode it wants reflected; defaults
   *  to 'legacy' so a plain download link (no mode specified) matches
   *  this module's own default. */
  async buildResultWorkbook(sessionId: string, importMode: NtrImportMode = 'legacy'): Promise<ExcelJS.Buffer> {
    const session = await this.sessionRepository.getById(sessionId);
    if (!session) {
      throw new Error('Import session not found');
    }
    if (!session.file_content) {
      throw new Error('Import session has no stored file - it may already be archived');
    }
    const buffer = Buffer.from(session.file_content, 'base64');
    const rows = await parseNtrImportFile(buffer, session.filename);
    const validated = await validateRows(rows, this.ntrRepository, importMode);
    const results: NtrImportRowResult[] = validated.map((v) => ({
      row: v.row.row,
      serial: v.row.serial || null,
      outcome: v.outcome,
      reason: humanize(v.reason),
    }));
    const warnings: ImportWarning[] = validated
      .filter((v): v is ValidatedRow & { warning: string } => !!v.warning)
      .map((v) => ({ row: v.row.row, reference: v.row.serial || null, message: v.warning }));
    return buildNtrImportResultWorkbook(rows, results, warnings);
  }

  async listSessions(): Promise<NtrImportSession[]> {
    return this.sessionRepository.list();
  }

  /** Sessions currently queued or retryable for Drive archiving - the
   *  Archive Queue view (Super Administrator only). */
  async listArchiveQueue(): Promise<NtrImportSession[]> {
    return this.sessionRepository.listArchiveQueue();
  }

  /** Uploads one session's stored file to Drive and marks it archived.
   *  Never throws - a Drive failure is recorded (status='Archive Failed',
   *  archive_attempts incremented, archive_error set) and audited, but
   *  always returns normally, so a caller processing many sessions in a
   *  queue never has one failure abort the batch. */
  async archiveSession(sessionId: string, actor: NtrImportActor): Promise<NtrImportSession> {
    const session = await this.sessionRepository.getById(sessionId);
    if (!session) {
      throw new Error('Import session not found');
    }
    if (!session.file_content) {
      // Already archived and cleared, or never had a file - nothing to do.
      return session;
    }

    const attemptAt = new Date().toISOString();
    try {
      const buffer = Buffer.from(session.file_content, 'base64');
      const ext = (session.filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const mimeType = ext === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const { url } = await uploadFileToDrive({
        buffer,
        filename: `legacy-import-${session.id}.${ext}`,
        mimeType,
        dealerFolderName: 'ntr_legacy_import',
      });

      const archived = await this.sessionRepository.update(
        session.id,
        {
          status: 'Archived',
          originalFileUrl: url,
          archivedAt: attemptAt,
          lastArchiveAttemptAt: attemptAt,
          archiveAttempts: session.archive_attempts + 1,
          archiveError: null,
          fileContent: null,
        },
        actor
      );

      await logAuditEvent({
        module: 'ntr',
        recordId: session.id,
        recordRef: session.filename,
        eventType: 'SystemEvent',
        fieldName: 'legacy_import_archive',
        newValue: JSON.stringify({ result: 'success', attempt: archived.archive_attempts, url }),
        performedBy: actor.username,
      });

      return archived;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Archive upload failed';
      const failedSession = await this.sessionRepository.update(
        session.id,
        {
          status: 'Archive Failed',
          lastArchiveAttemptAt: attemptAt,
          archiveAttempts: session.archive_attempts + 1,
          archiveError: message,
        },
        actor
      );

      await logAuditEvent({
        module: 'ntr',
        recordId: session.id,
        recordRef: session.filename,
        eventType: 'SystemEvent',
        fieldName: 'legacy_import_archive',
        newValue: JSON.stringify({ result: 'failed', attempt: failedSession.archive_attempts, error: message }),
        performedBy: actor.username,
      });

      return failedSession;
    }
  }

  /** Processes every session currently eligible for archiving (the
   *  Archive Queue's "Process queue" / individual "Retry" action). Each
   *  session is handled independently - one failure never blocks another. */
  async processArchiveQueue(actor: NtrImportActor, sessionId?: string): Promise<NtrImportSession[]> {
    const targets = sessionId ? [sessionId] : (await this.sessionRepository.listArchiveQueue()).map((s) => s.id);
    const results: NtrImportSession[] = [];
    for (const id of targets) {
      results.push(await this.archiveSession(id, actor));
    }
    return results;
  }
}

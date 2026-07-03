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
import { getDealer, logAuditEvent } from '@/lib/db';
import { uploadFileToDrive } from '@/lib/googleDrive';
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
    actor: NtrImportActor
  ): Promise<{ session: NtrImportSession; preview: NtrImportPreview }> {
    const rows = await parseNtrImportFile(fileBuffer, filename);
    const validated = await validateRows(rows, this.ntrRepository);
    const preview = toPreview(validated);
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
  async commit(sessionId: string, actor: NtrImportActor): Promise<NtrImportSession> {
    const session = await this.sessionRepository.getById(sessionId);
    if (!session) {
      throw new Error('Import session not found');
    }
    if (!session.file_content) {
      throw new Error('Import session has no stored file to commit');
    }

    const buffer = Buffer.from(session.file_content, 'base64');
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
        errors.push({ row: v.row.row, serial: v.row.serial || null, reason: err instanceof Error ? err.message : 'Import failed' });
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

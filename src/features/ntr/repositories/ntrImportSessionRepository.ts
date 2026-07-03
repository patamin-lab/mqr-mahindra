import { NtrImportSession, NtrImportSessionStatus } from '../types';

export interface NtrImportSessionCreateInput {
  importer: string;
  filename: string;
  fileContent: string;
  fileChecksum: string;
  totalRecords: number;
}

export interface NtrImportSessionUpdateInput {
  status?: NtrImportSessionStatus;
  validCount?: number;
  duplicateCount?: number;
  skippedCount?: number;
  failedCount?: number;
  errors?: { row: number; serial: string | null; reason: string }[];
  completedAt?: string;
  importedAt?: string;
  /** Explicitly settable to `null` (clears the stored file once archived) -
   *  `undefined` means "leave unchanged", so callers that never touch this
   *  field don't accidentally null it out. */
  fileContent?: string | null;
  originalFileUrl?: string | null;
  archiveJobId?: string | null;
  archiveAttempts?: number;
  lastArchiveAttemptAt?: string;
  archiveError?: string | null;
  archivedAt?: string | null;
}

export interface NtrImportSessionRepository {
  create(input: NtrImportSessionCreateInput, actor: { username: string }): Promise<NtrImportSession>;
  update(id: string, input: NtrImportSessionUpdateInput, actor: { username: string }): Promise<NtrImportSession>;
  getById(id: string): Promise<NtrImportSession | null>;
  /** Newest first, capped - the Import Audit view, never the full table. */
  list(limit?: number): Promise<NtrImportSession[]>;
  /** Sessions eligible for the Archive Queue - 'Archive Pending' (never
   *  attempted, or queued again after a retry request) and
   *  'Archive Failed' (retryable). Newest-first, same cap as `list()`. */
  listArchiveQueue(): Promise<NtrImportSession[]>;
}

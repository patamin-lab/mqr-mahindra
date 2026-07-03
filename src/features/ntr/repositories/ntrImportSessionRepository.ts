import { NtrImportSession } from '../types';

export interface NtrImportSessionCreateInput {
  importer: string;
  filename: string;
  originalFileUrl: string | null;
  totalRecords: number;
}

export interface NtrImportSessionUpdateInput {
  status?: 'Pending' | 'Completed' | 'Failed';
  validCount?: number;
  duplicateCount?: number;
  skippedCount?: number;
  failedCount?: number;
  errors?: { row: number; serial: string | null; reason: string }[];
  completedAt?: string;
}

export interface NtrImportSessionRepository {
  create(input: NtrImportSessionCreateInput, actor: { username: string }): Promise<NtrImportSession>;
  update(id: string, input: NtrImportSessionUpdateInput, actor: { username: string }): Promise<NtrImportSession>;
  getById(id: string): Promise<NtrImportSession | null>;
  /** Newest first, capped - the Import Audit view, never the full table. */
  list(limit?: number): Promise<NtrImportSession[]>;
}

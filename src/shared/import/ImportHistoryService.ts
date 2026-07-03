/**
 * Universal Import Framework — cross-module Import History (Step 5's
 * history view).
 *
 * Each module keeps owning its own session storage (NTR's
 * `ntr_import_sessions` table today) - there is no shared
 * `import_sessions` table, so this is a fan-out/merge layer, not a shared
 * repository. A module registers an `ImportHistoryProvider`; this file
 * only knows how to merge and sort whatever providers exist, keyed by
 * `module`, so the Import History view can show every module's runs in
 * one list once a second module exists, with zero changes needed here.
 */
import { ImportHistoryEntry } from './types';

export interface ImportHistoryProvider {
  module: string;
  list(): Promise<ImportHistoryEntry[]>;
}

export async function listImportHistory(providers: ImportHistoryProvider[]): Promise<ImportHistoryEntry[]> {
  const perModule = await Promise.all(providers.map((p) => p.list()));
  return perModule.flat().sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

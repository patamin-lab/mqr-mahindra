/**
 * Storage Hygiene configuration - how old something must be before
 * `OrphanCleanupService` treats it as abandoned rather than "still in
 * progress." A brand-new placeholder row (e.g. `initDirectUpload()`
 * mid-flight) must never be flagged just because a scan happened to run
 * seconds after it was created - see `docs/engineering/STORAGE_HYGIENE.md`.
 */
const DEFAULT_ORPHAN_RETENTION_HOURS = 24;

/** Reads `ORPHAN_RETENTION_HOURS` - unset or invalid falls back to the
 *  default rather than throwing, since this only affects a maintenance
 *  scan, never the upload/archive/restore paths themselves. */
export function getOrphanRetentionHours(): number {
  const raw = process.env.ORPHAN_RETENTION_HOURS;
  if (!raw) return DEFAULT_ORPHAN_RETENTION_HOURS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ORPHAN_RETENTION_HOURS;
}

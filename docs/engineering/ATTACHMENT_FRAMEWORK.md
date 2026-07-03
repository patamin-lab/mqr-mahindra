# Attachment Framework

`src/shared/attachments/` — the platform-wide file storage abstraction
every module (PM, PDI, NTR, MQR, Campaign, Parts, Machine 360, and beyond)
is meant to depend on for uploading, listing, signing, archiving, and
restoring files. See `docs/adr/ADR-010-Attachment-Platform.md` for the
full rationale; this document is the living reference for how it's built.

Unlike the Universal Import Framework (`src/shared/import/`, built with
only NTR as a real consumer), this framework satisfies
`.claude/rules/01-architecture-boundaries.md`'s "shared/ only when at
least two modules genuinely need it" from day one in intent (every module
listed above needs file storage) - though as of this pass, **no existing
module has been migrated onto it yet**; see "What's deliberately deferred"
below.

## Why Attachment, not `media_files`

"Attachment" is the platform's existing business term (see
`docs/standards/DOMAIN_LANGUAGE_STANDARD.md`'s General terminology table:
Attachment → ไฟล์แนบ) and already appears in `docs/standards/*` and the
audit-event vocabulary (`AttachmentAdded`/`AttachmentRemoved`). `attachments`
is the table name; there is no `media_files` table.

## Data model

`attachments` (migration `create_attachments_platform`):

| Column | Purpose |
|---|---|
| `module`, `entity_type`, `entity_id` | What business record this file belongs to - no FK (types vary per module: uuid vs. text), scoped in application code exactly like every other cross-module reference in this app |
| `attachment_type` | `MasterData`/`MeterPhoto`/`NameplatePhoto`/`ReportPhoto`/`DefectPhoto`/`RepairPhoto`/`CustomerSignature`/`Invoice`/`Warranty`/`Video`/`Audio`/`Pdf`/`Excel`/`Other` |
| `storage_provider` | `SUPABASE` \| `GOOGLE_DRIVE` - which backend currently holds the bytes |
| `storage_path` | Supabase Storage object path (null once archived and the source copy is deleted) |
| `drive_file_id`, `drive_url` | Populated only once archived |
| `status` | `ACTIVE` → `ARCHIVE_PENDING` → `ARCHIVING` → `ARCHIVED` → `PURGED` (future) |
| `archive_attempts`, `last_archive_attempt_at`, `archive_error` | Retry bookkeeping - mirrors the pattern used by NTR's own Drive archive queue (ADR-008 on `feature/ntr-legacy-import`) |
| `business_completed_at` | Set by the owning module when its record reaches a terminal state - starts the retention clock |
| `checksum`, `size_bytes` | Recorded at upload; re-verified at archive time and on demand via `verifyChecksum()` |

`attachment_retention_policies` (`module` primary key, `retention_days`
nullable): configurable per module, never hardcoded in application code.
Seeded today: PM 730 days, MQR 365 days, PDI 365 days, NTR `null` (never
auto-archive) - a new module adds its own row, no code change required.

Both tables use the same permissive-RLS-plus-app-layer-scoping model as
every other table in this app (see root `CLAUDE.md` §6) - `qual: true`
policies, authorization enforced in `AttachmentService`/its callers.

## Provider Independence

```ts
interface StorageProvider {
  readonly name: 'SUPABASE' | 'GOOGLE_DRIVE';
  upload(params): Promise<StoredObject>;
  delete(locator): Promise<void>;
  download(locator): Promise<Buffer>;
  getUrl(locator, mimeType, expiresInSeconds?): Promise<{ url; expiresAt }>;
}
```

`SupabaseStorageProvider` (primary) and `GoogleDriveStorageProvider`
(archive) both implement this - `AttachmentService` never branches on
which provider it's talking to beyond choosing which instance to call. A
future `AWS S3`/`Cloudflare R2`/`Azure Blob` provider is a new class
implementing the same interface; no existing code changes.

`SupabaseStorageProvider` uses the `mqr-files` bucket (`STORAGE_BUCKET` in
`lib/supabase.ts`) - previously declared but never referenced (the app
moved to Google Drive before ever using it for real). This is the first
real consumer. Two new storage-level RLS policies (`mqr_files_select`,
`mqr_files_delete`, plus `mqr_files_update`) were added - only an `INSERT`
policy existed before, left over from that earlier, abandoned attempt.

`GoogleDriveStorageProvider` reuses `lib/googleDrive.ts`'s existing
`uploadFileToDrive()`, adding two new exports it needed that didn't exist
yet: `downloadFileFromDrive()` (restore/checksum-verify) and
`deleteFileFromDrive()`.

## AttachmentService

The one door every module/UI calls (Machine 360 included) - never a
storage provider or SDK directly:

- `upload(input)` — uploads to Supabase (primary), records the row.
- `delete(id)` — deletes from whichever provider currently holds the
  bytes (`storageProvider` on the row), then the row itself.
- `list(module, entityType, entityId)`
- `getUrl(id)` — a Supabase signed URL while `ACTIVE`; the Drive share
  link directly once `ARCHIVED` (Drive doesn't support the same kind of
  time-limited signed URL via this app's OAuth2-as-a-real-account setup -
  documented, not silently approximated).
- `verifyChecksum(id)` — re-downloads from the active provider and
  re-hashes (SHA-256), compared against the `checksum` column.
- `markBusinessComplete(id, completedAt?)` — a module calls this once,
  when its own record reaches a terminal state; starts the retention
  clock. Never inferred by the platform itself.
- `enqueueArchiveEligible(module)` — Archive flow step 1: `ACTIVE` →
  `ARCHIVE_PENDING` for every attachment past its module's (non-null)
  retention window.
- `processArchiveQueue()` — Archive flow step 2: uploads each
  `ARCHIVE_PENDING` row to Drive, verifies checksum + size against the
  original, only then marks `ARCHIVED` and (if
  `DELETE_SOURCE_AFTER_VERIFIED_ARCHIVE`, on by default) deletes the
  Supabase copy. A failure leaves the row `ARCHIVE_PENDING` with
  `archiveAttempts` incremented for retry, up to 5 attempts - never
  deletes the source before a verified success.
- `restore(id)` — downloads an `ARCHIVED` attachment's bytes back from
  Drive into Supabase Storage, flips it back to `ACTIVE`/`SUPABASE`.

## Archive Lifecycle

```
ACTIVE → ARCHIVE_PENDING → ARCHIVING → ARCHIVED → PURGED (future)
```

Never delete a file before successful verification - `processArchiveQueue()`
checks both size and checksum against the original before marking
`ARCHIVED` or touching the Supabase copy.

## What's deliberately deferred

MQR's `report-form.tsx` and PM's create form still upload straight to
Google Drive via the existing `/api/upload*` routes (see root
`CLAUDE.md` §8.2) - **not yet migrated onto `AttachmentService`**. That
migration means changing production-critical upload code (`report-form.tsx`
is flagged in root `CLAUDE.md` as "the most complex file in the repo") and
touching two modules' live upload paths; it wasn't requested as part of
this pass ("build the permanent Attachment & Media Platform", not
"migrate every existing upload"), and doing it without its own dedicated
review would be a much larger, unreviewed risk than the platform itself.
Machine 360 similarly doesn't yet render an Attachments section, since no
module writes rows into `attachments` yet - once PM/MQR (or a new module)
adopts `AttachmentService.upload()`, Machine 360 can list them via
`AttachmentService.list()` with no further platform changes.

## Adopting this for a new (or existing) module

1. Add a `attachment_retention_policies` row for the module (or leave
   `retention_days` null to never auto-archive).
2. Call `new AttachmentService().upload({ module, entityType, entityId,
   attachmentType, filename, mimeType, buffer, createdBy })` at the point
   a file is accepted.
3. Call `markBusinessComplete(attachmentId)` once the owning record
   reaches a terminal state.
4. Run `enqueueArchiveEligible(module)` then `processArchiveQueue()`
   periodically (a scheduled route, following the existing Scheduler
   pattern in `docs/SCHEDULER_ARCHITECTURE.md`/ADR-007) - not wired to a
   route in this pass since no module produces real attachments yet.

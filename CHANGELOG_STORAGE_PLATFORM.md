# Changelog — Storage Platform

Human-readable summary of the Storage Platform's build-out, from the
original Attachment Platform (Phase 5B) through this freeze/release. See
`docs/engineering/STORAGE_PLATFORM_FINAL.md` for the architecture and
`docs/engineering/STORAGE_PLATFORM_DECISION.md` for the rationale behind
each choice below.

## Storage abstraction

Every module now goes through one door - `AttachmentService` - instead of
implementing its own upload/delete/download logic. A `StorageProvider`
interface (`upload`/`download`/`delete`/`exists`/`getSignedUrl`/`list`,
plus optional `createSignedUploadUrl`/`statObject` for large-file direct
uploads) is the only thing a storage backend needs to implement, and
`StorageProviderFactory` chooses which one is active from configuration
(`STORAGE_PROVIDER`/`ARCHIVE_PROVIDER`) - a provider swap is an
environment-variable change, never a code change to `AttachmentService`
or any module.

## Cloudflare R2 integration

A third `StorageProvider` implementation, `CloudflareR2Provider`, built
on R2's S3-compatible API (`@aws-sdk/client-s3`/
`@aws-sdk/s3-request-presigner`). Fully implemented, unit-tested, and
live-verified against a real R2 bucket in development - but **not
selected as the default primary or archive provider anywhere**. It
deliberately never returns a permanent/public object URL (a real bucket
misconfiguration was found and fixed during the Production Readiness
Review - see Operational limitations below); the only way to get a
usable URL is a time-limited signed URL via `AttachmentService.getUrl()`.
`ARCHIVE_PROVIDER=CLOUDFLARE_R2` is explicitly rejected at configuration
time, since `getUrl()` has no path yet to resolve a signed URL for a
non-Google-Drive archive provider.

## Attachment platform

`AttachmentService`/`AttachmentRepository` (the `attachments` table) -
the shared upload/list/getUrl/delete/restore surface MQR, PM/Maintenance,
and Machine 360 all consume today. Object metadata (`storage_provider`,
`checksum`, `size_bytes`) always reflects the real provider that stored
the bytes - a hardcoded-provider regression found via live testing was
fixed to thread the actual provider name through every write path.
Object-key path segments derived from caller input are sanitized before
becoming part of a storage key.

## Lifecycle engine

`ACTIVE -> ARCHIVE_PENDING -> ARCHIVING -> ARCHIVED` (with retry up to
`MAX_ARCHIVE_ATTEMPTS`, checksum/size verification before ever deleting
the primary copy) and `ARCHIVED -> ACTIVE` (`restore()`). Direct
(browser-to-storage) large-file uploads run a two-step variant
(`initDirectUpload()`/`finalizeDirectUpload()`) so a single-shot POST
never has to carry a file past Vercel's request-body cap. `PURGED` is
reserved in the status enum for a future retention-purge feature - not
yet implemented.

## Storage operations

A maintenance/operations layer sits on top of the same primitives, all
callable but **never automatically scheduled**:

- `OrphanCleanupService` - detects five distinct orphan-attachment cases;
  cleans up only when explicitly told to (dry-run by default, and a
  `MANUAL_REVIEW` finding is never auto-actioned regardless of mode).
- `StorageHealthService` - a live, on-demand upload/download/delete probe
  against one provider, plus archive-error rate and module-scoped storage
  usage.
- `StorageMetricsService` - per-module object counts, storage bytes,
  uploads/day, archive count, orphan count.
- `StorageAuditService` - composes the above into one daily
  `StorageAuditReport`.
- `StorageScheduler` - the callable surface a future cron trigger would
  invoke for archive/orphan-cleanup/health-check jobs - not itself wired
  to any timer.

## Operational limitations

- **`downloadsPerDay`/`deletesPerDay` are always `null`** - this platform
  has no per-request event log; deletes remove the attachment row
  entirely with no tombstone. Reported honestly as unavailable rather
  than estimated.
- **No persisted audit-report or job-run history** - growth/failed-job
  trend fields require the caller to supply a prior snapshot.
- **`FAILED_RESTORE` orphan detection is partial** - `restore()` has no
  intermediate status the way archiving has `ARCHIVING`; a genuinely
  interrupted restore usually surfaces as `ORPHAN_OBJECT` instead.
- **No automatic scheduling anywhere** - every operational job (archive,
  orphan cleanup, health check) requires a manual/admin-triggered call
  today.
- **Cloudflare R2 CORS** was the last confirmed-open infrastructure
  blocker as of the last live check - browser-direct uploads to R2 would
  fail preflight until configured via the Cloudflare dashboard. Does not
  affect the currently-active Supabase/Google Drive path.
- **No automated architecture-boundary enforcement** (`scripts/architecture-check.ts`
  does not exist) - dependency-direction/boundary rules are enforced by
  convention and code review only.

## Migration impact

**None for existing data or running behavior.** `STORAGE_PROVIDER`/
`ARCHIVE_PROVIDER` are unset in every environment today, so every
`AttachmentService` instance still resolves to Supabase primary / Google
Drive archive, identical to before `StorageProviderFactory` existed.
Every schema change across this entire build-out was additive (new
tables, new nullable columns, new CHECK-constraint values) - nothing was
dropped, renamed, or made non-nullable in a way that would break an
existing row. No business module (MQR, PM/Maintenance, Machine 360) was
modified as part of the Storage Operations, Storage Hygiene, or Platform
Freeze milestones - all consume `AttachmentService` exactly as they did
before this changelog's work began. Adopting Cloudflare R2 as an active
default, in any environment, remains a distinct, not-yet-made, separately
approved decision.

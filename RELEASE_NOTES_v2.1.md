# Release Notes — v2.1: Storage Platform

Companion documents: `CHANGELOG_STORAGE_PLATFORM.md` (detailed
feature-by-feature summary), `docs/engineering/STORAGE_PLATFORM_FINAL.md`
(architecture), `docs/engineering/STORAGE_PLATFORM_DECISION.md`
(rationale/roadmap), `docs/release/STORAGE_PLATFORM_RELEASE.md`
(release audit), `docs/architecture/PLATFORM_CONSTITUTION.md` (permanent
policy), `docs/engineering/ARCHITECTURE_ENFORCEMENT.md` (automated
boundary checks).

## Major architectural changes

- **One storage door**: every module now goes through `AttachmentService`
  for file storage - never a provider, the repository, or a storage SDK
  directly. Enforced by convention since Phase 5B, and by an automated
  check (`npm run architecture`) as of this release.
- **Provider abstraction**: three interchangeable `StorageProvider`
  implementations (`SupabaseStorageProvider`/`GoogleDriveStorageProvider`
  active by default, `CloudflareR2Provider` implemented but not selected),
  chosen entirely via `StorageProviderFactory` configuration
  (`STORAGE_PROVIDER`/`ARCHIVE_PROVIDER`) - a provider swap is an
  environment-variable change, never a code change.
- **Never a permanent/public object URL**: fixed during the R2
  Production Readiness hardening - `upload()` never returns a public
  URL; the only way to get a renderable one is a fresh, time-limited
  signed URL via `AttachmentService.getUrl()`.
- **Operational layer**: `OrphanCleanupService`, `StorageHealthService`,
  `StorageMetricsService`, `StorageAuditService`, `StorageScheduler` - all
  callable, none automatically scheduled.
- **Automated architecture enforcement**: `scripts/architecture-check.ts`
  (`npm run architecture`) validates import-boundary rules and is now a
  required, fail-fast step in CI (runs before typecheck/lint/test/build).
- **Platform Constitution**: `docs/architecture/PLATFORM_CONSTITUTION.md`
  is now the permanent, binding architecture policy for MASP - layer
  definitions, dependency rules, platform service boundaries,
  infrastructure rules, domain language, event rules, storage rules, and
  future-extension rules.

## Migration summary

**No data migration required for this release.** Every schema change
across the Storage Platform's build-out was additive (new tables, new
nullable columns, new CHECK-constraint values) - nothing was dropped,
renamed, or made non-nullable in a way that would break an existing row.
`STORAGE_PROVIDER`/`ARCHIVE_PROVIDER` remain unset in every environment,
so every `AttachmentService` instance still resolves to Supabase primary
/ Google Drive archive - identical behavior to before this platform
existed. No business module (MQR, PM/Maintenance, Machine 360) changed
behavior as part of this release. Adopting Cloudflare R2 as an active
default anywhere remains a distinct, separately-approved future decision,
not part of this release.

## Verification summary

- `npm run architecture` → 5/5 rules PASS (business modules never import
  platform internals or raw SDKs; only `AttachmentService` + the
  documented operational exception access providers; only
  `StorageProviderFactory` constructs one; no circular dependency inside
  `src/shared/attachments`); CI-integration self-check PASS
  (`.github/workflows/ci.yml` now runs it before typecheck/lint/test/build).
- `npm run lint` → 0 errors, 7 pre-existing unrelated warnings (`<img>`/
  alt-text, none in the Storage Platform).
- `npm run typecheck` → clean.
- `npm test` → 308/308 passing.
- `npm run build` → succeeds.
- Live E2E verification (real Cloudflare R2 bucket + Supabase DB, dev
  environment only) performed across multiple milestones during
  build-out - never fabricated, always cleaned up afterward.

## Known limitations

- **Cloudflare R2 CORS** was the last confirmed-open infrastructure
  blocker as of the last live check - browser-direct uploads to R2 would
  fail preflight until configured via the Cloudflare dashboard. Does not
  affect the currently-active Supabase/Google Drive path.
- **`downloadsPerDay`/`deletesPerDay`** are always `null` - no
  per-request event log exists to derive them from; deletes remove the
  row entirely.
- **No persisted audit-report or job-run history** - `StorageAuditService`
  trend fields require the caller to supply a prior snapshot.
- **`FAILED_RESTORE` orphan detection is partial** - `restore()` has no
  intermediate status the way archiving has `ARCHIVING`.
- **No automatic scheduling anywhere** - `StorageScheduler` and the
  orphan-cleanup API route are callable-only; a real cron integration
  needs a service credential not yet built.
- **`scripts/architecture-check.ts` is scoped to the Storage Platform's
  own rules** - it does not yet check the rest of
  `PLATFORM_CONSTITUTION.md`'s general dependency rules (e.g.
  module-to-module isolation beyond storage).

## Production prerequisites

Before any environment sets `STORAGE_PROVIDER=CLOUDFLARE_R2`/
`ARCHIVE_PROVIDER=CLOUDFLARE_R2`:

1. Configure CORS on the R2 bucket via the Cloudflare dashboard (the
   application's own API token cannot read or write bucket CORS config).
2. Re-run a live end-to-end verification against that environment's real
   bucket.
3. Explicit, separate approval to switch the default.
4. For archive-side R2 specifically: implement
   `AttachmentService.getUrl()`'s missing signed-URL path for a
   non-Google-Drive archive provider first.

No prerequisite blocks the parts of the platform already live (Supabase
primary / Google Drive archive) - that path has been in production use
since Phase 5B.1 with no open blocker. This release does not itself
change what's live in any environment.

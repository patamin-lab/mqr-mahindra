# Release Summary — Platform Consolidation

> **Status: HISTORICAL — superseded.** Written when both streams below
> were still unmerged/uncommitted. Since then: the Storage Platform work
> was committed (`9915f3d`) and `feature/ntr-legacy-import` was merged to
> `main` (`5dd4b51`, PR #10), then `origin/main` was merged into
> `feature/pm-record-workflow-redesign` (`0dc13d3`). `PROJECT_STATE.md` is
> the current source of truth; this file is kept as a dated record of the
> consolidation decision itself, not current status.

Covers four completed milestone streams across two unmerged branches.
Nothing in this document has been merged, tagged, or released - it is a
consolidated summary prepared ahead of that decision, per this
milestone's own "no tags, no merges" instruction.

## Completed Milestones

**On `feature/pm-record-workflow-redesign`** (uncommitted, stashed as
`storage-platform-v1.0-uncommitted`/`storage-platform-v1.0-uncommitted-env-example`):
- Storage Platform v2.1 - `AttachmentService`/`StorageProvider`
  abstraction, Cloudflare R2 provider, `StorageProviderFactory`,
  Storage Hygiene (orphan cleanup), Storage Operations (health/metrics/
  audit/scheduler), full live UAT (Preview deployment + real R2/Supabase).
- Architecture Governance - `docs/architecture/PLATFORM_CONSTITUTION.md`
  (permanent, repo-wide policy).
- Architecture Enforcement - `scripts/architecture-check.ts`
  (`npm run architecture`), wired into CI.

**On `feature/ntr-legacy-import`** (10 commits ahead of `main`, plus
uncommitted enhancement/UAT work from this session):
- NTR Historical Import Framework v1.0 - already a mature, working
  system before this session (alias-based column mapping, dry-run
  preview → atomic per-row commit, full audit trail) - enhanced this
  session with address hierarchy validation, configurable Serial Number
  policy (Legacy/Strict), in-file duplicate detection, date validation,
  downloadable `NTR_IMPORT_RESULT.xlsx`, then live-UAT'd (found and fixed
  a critical 10,000-row performance defect plus three smaller bugs).
  Verdict: **PASS - READY TO MERGE.**

## Architecture Changes

- Storage: one abstraction (`AttachmentService`) in front of swappable
  providers (Supabase Storage/Google Drive/Cloudflare R2), chosen by
  configuration, never a code change.
- A permanent, written architecture policy
  (`PLATFORM_CONSTITUTION.md`) and a first automated enforcement check
  for part of it now exist - previously convention-only.
- NTR's Legacy Import now validates against a real, bundled Thailand
  administrative-boundary reference dataset (loaded once into memory)
  instead of accepting free-text address fields unchecked.
- NTR's per-row database lookups (dealer/vehicle/existing-NTR checks)
  were batched into bulk, chunked queries - a real performance-
  architecture fix, not a business-logic change.

## Breaking Changes

**None.** Every change across both branches is additive:
- No default storage provider was switched anywhere (Supabase primary /
  Google Drive archive remain default everywhere).
- NTR's Legacy Import Mode defaults to the pre-existing production
  behavior (auto-create Tractor on unknown serial); Strict Mode is
  opt-in only.
- No table was redesigned; every schema addition (Storage Platform's
  additive columns/tables, none on the NTR side this session) is
  additive-only.

## Migration Notes

- Nothing requires a data migration - both streams are additive.
- Before merging the Storage Platform stash: it was created on
  `feature/pm-record-workflow-redesign` and has never been applied or
  committed; applying it will need the same verification suite re-run
  post-apply (not assumed to still pass unchanged, though nothing should
  have drifted).
- Before merging `feature/ntr-legacy-import`: 21 currently-uncommitted
  files (this session's enhancement + UAT fixes) need an explicit commit
  first - nothing was committed this session per standing instruction.
- Cloudflare R2 CORS configuration (Storage Platform) was confirmed
  resolved in a prior live UAT round - re-verify if significant time has
  passed before any production R2 cutover decision.

## Known Limitations

- Storage Platform: `downloadsPerDay`/`deletesPerDay` metrics remain
  `null` (no event log exists); no persisted audit-history; `scripts/architecture-check.ts`
  only covers Storage Platform's own five rules, not the full
  Constitution.
- NTR: no Invoice/Registration-Number duplicate detection (no such
  column exists in this schema); `FAILED_RESTORE`-equivalent partial-
  failure states aren't applicable here but the same "no fabricated
  columns" discipline applied; phone/customer-name duplicate detection
  is in-file only, not database-wide (a deliberate performance trade-off,
  documented in `docs/import/NTR_HISTORICAL_IMPORT.md`).
- Two differently-scoped "Phase 6"/"Next Phase" documents now exist
  (the Storage-Platform-stash's narrower hardening-focused one, and this
  milestone's broader `docs/roadmap/PHASE_6_PLAN.md`) - flagged for
  reconciliation, not resolved.

## Future Work

See `docs/roadmap/PHASE_6_PLAN.md` for the full, ordered plan: Workflow
Engine → Notification Platform → Machine Domain (extension) → Dashboard
→ Analytics → AI Platform. Also see the Storage-Platform-stash's own
`NEXT_PHASE.md` for its narrower architecture-hardening recommendations
(architecture-check expansion, R2 CORS follow-up, framework major-version
upgrade) - both should be reconciled into one plan once the stash is
committed.

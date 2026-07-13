# Technical Debt — Platform Baseline v1.0

Confirmed findings only, from this freeze's repository/dependency/
documentation review. Nothing below is invented or speculative - each
item was verified against actual code, config, or documentation content
during this milestone. See `docs/PLATFORM_BASELINE.md` for the baseline
this debt is measured against and `NEXT_PHASE.md` for how some of these
map onto the recommended Phase 6 plan.

## Immediate

### 1. CI's new "Verify architecture" step is untested on a real CI run
- **Impact**: `.github/workflows/ci.yml` now runs `npm run architecture`
  (via `tsx`) on GitHub Actions' Node 20 runner. It has only been run
  locally on Node 24 so far. `tsx` is a portable, well-established
  runner, but this specific combination (this exact script, this exact
  CI environment) has not yet executed for real.
- **Priority**: Immediate - verify on the very next PR/push, before
  relying on it as a merge gate.
- **Recommended milestone**: none - just watch the first real CI run.

### 2. ~~Root `CLAUDE.md`'s deployment section is stale~~ — RESOLVED
- **Resolution** (Release Completion pass): `CLAUDE.md` §3 rewritten to
  describe the actual git-CLI-based workflow (real `origin` remote,
  checked-out working tree) instead of the obsolete GitHub-web-UI-upload
  description.

## Short-term

### 3. ~~Two similarly-named, differently-scoped release checklists~~ — RESOLVED
- **Resolution** (Release Completion pass): the root `RELEASE_CHECKLIST.md`
  was renamed to `docs/releases/RELEASE_CHECKLIST_STORAGE_PLATFORM_V2.1.md`,
  alongside `docs/releases/RELEASE_CHECKLIST_V1.md` (the original MQR/PM
  release) - same directory, no more naming collision.

### 4. `scripts/architecture-check.ts` only covers Storage Platform rules
- **Impact**: `docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md` documents
  repo-wide dependency rules (e.g. "a module may not import another
  module's internals directly," "`shared/` never imports from a business
  module" as a general rule) that the current script does not check -
  it validates only the five Storage-Platform-specific rules it was
  built for. A boundary violation anywhere else in the codebase today
  would go undetected by CI.
- **Priority**: Short-term.
- **Recommended milestone**: "Architecture Enforcement Expansion" (see
  `NEXT_PHASE.md`).

### 5. Cloudflare R2 CORS is unconfigured
- **Impact**: confirmed via live preflight testing (`R2_PRODUCTION_READINESS.md`)
  - a browser-direct upload to R2 would fail. Blocks any future decision
  to adopt R2 as primary storage; does not affect the currently-active
  Supabase/Google Drive path.
- **Priority**: Short-term (only urgent once R2 adoption is actually
  planned).
- **Recommended milestone**: "R2 CORS Configuration" - a Cloudflare
  dashboard action, not a code change; a prerequisite listed in
  `docs/PLATFORM_BASELINE.md`/`STORAGE_PLATFORM_RELEASE.md`.

### 6. No persisted audit-report or job-run history
- **Impact**: `StorageAuditService.generateDailyAuditReport()`'s growth/
  failed-job trend fields are `null`/empty unless a caller supplies its
  own prior snapshot - there is no table or file storing yesterday's
  report today, so nothing currently does supply one. The daily audit
  is real but stateless.
- **Priority**: Short-term (limits the operational value of the audit
  feature already built).
- **Recommended milestone**: "Storage Observability Persistence" -
  decide where snapshots live (a new small table, or a scheduled job
  writing to existing logging/monitoring infra once one exists) before
  building it.

## Long-term

### 7. `downloadsPerDay`/`deletesPerDay` are not derivable
- **Impact**: no per-request event log exists; deletes remove the
  `attachments` row entirely with no tombstone. `StorageMetricsService`
  honestly returns `null` rather than a fabricated number.
- **Priority**: Long-term - requires a schema change (an event log),
  explicitly out of scope for every milestone so far ("do not redesign
  the storage architecture").
- **Recommended milestone**: "Platform Event Log for Storage Operations" -
  possibly reusing/extending the existing Vehicle Event framework's
  publisher pattern rather than inventing a second event-logging
  mechanism.

### 8. `FAILED_RESTORE` orphan detection is only partial
- **Impact**: `AttachmentService.restore()` has no intermediate status
  the way archiving has `ARCHIVING` - a restore interrupted mid-flight
  surfaces as `ORPHAN_OBJECT` instead of its own distinct finding.
- **Priority**: Long-term - requires a schema change (a `RESTORING`
  status) explicitly deferred as "a real feature, out of scope" in
  `STORAGE_HYGIENE.md`.
- **Recommended milestone**: "Restore Lifecycle Status."

### 9. No cron trigger exists for `StorageScheduler`/orphan cleanup
- **Impact**: every operational job (archive, orphan cleanup, health
  check) requires a manual, session-authenticated API call today. A real
  cron integration needs a service-to-service credential distinct from
  the SuperAdmin session check every admin route currently uses.
- **Priority**: Long-term - "do not enable automatic scheduling"/"do not
  enable automatic cleanup" have applied to every milestone so far and
  remain in force until explicitly lifted.
- **Recommended milestone**: "Scheduled Storage Operations + Service
  Auth."

### 10. Major dependency versions not upgraded (pre-existing, confirmed
still open)
- **Impact**: documented in `PROJECT_STATE.md`'s M6.4 entry - 7 npm audit
  findings (4 High, 3 Medium) all require `next` 14→16 (two majors),
  which cascades into `react`/`react-dom` 18→19, `eslint` 8→10,
  `eslint-config-next` 14→16, `jose` 5→6 (session-signing, auth-critical),
  `typescript` 5→6, `tailwindcss` 3→4 (breaking config format), `zod`
  3→4, and several `@types/*` packages. Re-confirmed still open as of
  this freeze (`package.json`'s versions are unchanged from M6.4).
- **Priority**: Long-term - high blast radius, needs its own dedicated
  migration/testing effort, not something to fold into a documentation
  freeze.
- **Recommended milestone**: "Framework Major Version Upgrade" (already
  listed as a candidate in `PROJECT_STATE.md`; restated here since it's
  still the single biggest open risk item repo-wide).

### 11. Two devDependency install scripts flagged as unreviewed
- **Impact**: `npm install` flags `unrs-resolver@1.12.2` (pre-existing,
  noted in M6.4) and, newly, `esbuild@0.28.1` (a transitive dependency of
  the `tsx` devDependency added for `scripts/architecture-check.ts`) as
  having unreviewed install scripts under npm's `allow-scripts` feature.
  Neither has a known CVE; both are devDependency-only, never shipped in
  the deployed app.
- **Priority**: Long-term/informational - not a known vulnerability, just
  an unreviewed-script flag worth a human glance
  (`npm approve-scripts`), not auto-approved here.
- **Recommended milestone**: none required - a five-minute manual review
  whenever convenient.

## Explicitly not counted as debt

- Cloudflare R2 not being the default primary/archive provider anywhere
  is a **deliberate, documented decision**, not debt - see
  `docs/engineering/STORAGE_PLATFORM_DECISION.md`.
- The four legacy unused columns on `pm_records` (`model`,
  `delivery_date`, `customer_name`, `customer_phone`) are already
  tracked in `PROJECT_STATE.md` and are now actually used as snapshot
  fields as of later phases - re-verified not to be dead columns during
  this review, so not repeated here as new debt.

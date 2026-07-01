Current Sprint: Sprint 10
Current Branch: feature/pm-record-types
Current Module: PM Record
Current Milestone: M6.5 Complete — Final Release Candidate Review (READY FOR MERGE)
Current Status: Complete

Architecture: Frozen
Documentation: Frozen
ADR: 7 Approved

Delivered (Complete):
- src/features/pm-record/ — types, Zod schemas wired into both API routes,
  validation helpers, PmRecordRepository interface, SupabasePmRecordRepository
  (full CRUD, soft delete, dealer scoping), PmRecordService, shared
  create/edit form component, fetch-by-id helper
- src/app/api/pm-records/ — GET (list), POST (create) — standardized
  { ok, data } / { ok, error: { code, message } } envelope
- src/app/api/pm-records/[id]/ — GET (detail), PUT (update), DELETE
  (soft delete) — PATCH removed (was an unused stub)
- src/app/(app)/pm-records/ — list page, create page (new/), detail page
  ([id]/), edit page ([id]/edit/), delete action (delete-button.tsx) — all
  session-gated, with loading/saving states and success/error toasts
- Automated tests (Vitest, introduced this module — no framework existed
  before): unit tests for PmRecordService and SupabasePmRecordRepository
  (service.test.ts, supabaseRepository.test.ts); API integration tests for
  every endpoint (route.test.ts at both route levels), mocking only the
  Repository layer
- Database Hardening & RLS Audit (read-only, no code changed): confirmed
  soft delete/audit-field logic is correct in code; confirmed UI never
  bypasses Service/Repository; found two live-schema defects (below)

Resolved in M6.1 (Supabase migration `align_pm_records_soft_delete_and_constraints`,
version 20260701130836, applied to live project `lhlzzxjayywqhqtjzfiu`):
- Live `pm_records` table now has `record_status` (`NOT NULL DEFAULT 'Active'`,
  check constraint `Active`/`Deleted`), `deleted_by`, `deleted_at` — matching
  every repository method's assumption
- Live `pm_records.scheduled_date` is now nullable, matching the app's
  end-to-end optional treatment
- Added indexes on `dealer_id`, `branch_id`, `technician_id`, `record_status`
  (previously only the PK was indexed)
- Table had 0 rows at migration time — purely additive/constraint-relaxing,
  no data migration was needed, no destructive changes made

Resolved in M6.2 (Supabase migration `harden_pm_records_rls_soft_delete_scoping`,
version 20260701131859, applied to live project `lhlzzxjayywqhqtjzfiu`):
- `pm_records_anon_upd` now requires `record_status = 'Active'` to select a
  row for update (was unconditional `true`) — an already-soft-deleted row
  can no longer be touched by any raw update, independent of application
  code; `WITH CHECK (true)` is explicit so the Active→Deleted transition
  itself still succeeds
- `pm_records_anon_ins` now requires the inserted row's `record_status` to
  be `'Active'` (was unconditional `true`)
- `pm_records_anon_sel` now requires `record_status = 'Active'` to be
  visible at all (was unconditional `true`) — a soft-deleted row is now
  invisible even to a raw anon-key API call; zero app behavior change
  since `getById()`/`list()` already treated a Deleted row as "not found"
- Confirmed (no change needed): no DELETE policy exists on `pm_records` —
  hard delete via the anon key was already impossible before this
  milestone, Postgres RLS defaults to deny with no matching policy

Still-open, unresolved (structural, not fixed by M6.2 — requires a code
change explicitly out of a migration-only milestone's scope):
- **No RLS-enforced dealer/branch isolation exists, and none can be added
  without a code change.** This app has no Supabase Auth and sets no
  per-request Postgres session variable — every request reaches Postgres
  through one shared `anon` role with zero identity signal, so a
  dealer-scoped RLS policy has nothing to filter on. Real isolation
  requires either adopting Supabase Auth with custom claims or having the
  app `set_config()` a per-request session variable — both are future,
  separately-authorized architecture decisions, not migration work.
  Dealer/branch/actor-identity scoping remains 100% application-layer
  (`PmRecordService` + route handlers), matching every other table in
  this project (`applyScope()` in `lib/db.ts`).
- Four unused legacy columns (`model`, `delivery_date`, `customer_name`,
  `customer_phone`) remain on `pm_records`, harmless but not part of
  `PmRecord`'s type — schema-cleanliness cleanup, not a defect

Resolved in M6.3 (repo-wide, not PM-Record-specific):
- Added `.github/workflows/ci.yml` — runs on every `push`/`pull_request`:
  `npm ci` → `tsc --noEmit` → `npm run lint` → `npm run build` →
  `npm test`, Node 20, npm dependency caching via `actions/setup-node`.
  This repository previously had no CI at all (`docs/DEVELOPMENT_GUIDE.md`
  §5/§6 said so explicitly; now corrected).
- Verified `next build` needs no environment variables in CI: every
  `process.env.*` read in `src/` is inside a function body (evaluated at
  request time) or has a hardcoded fallback, not evaluated at build/import
  time — confirmed by grep, not assumed.

Resolved in M6.4 (repo-wide, not PM-Record-specific — package-lock.json
only, no package.json range changes, since all 3 were already permitted
by the existing caret ranges):
- `@supabase/supabase-js` 2.108.2 → 2.110.0 (safe minor update)
- `autoprefixer` 10.5.0 → 10.5.2 (safe patch update)
- `resend` 6.14.0 → 6.16.0 (safe minor update)

Documented only, NOT applied (all require a breaking major-version bump —
out of this milestone's scope per its own "document only" instruction):
- **7 npm audit findings (4 High, 3 Medium), all fixable only via
  `npm audit fix --force`:**
  - High: `next` (installed 14.2.35) — multiple CVEs (DoS via Image
    Optimizer/Server Components, HTTP request smuggling in rewrites,
    middleware cache poisoning/bypass, XSS via CSP nonces/beforeInteractive
    scripts) — fix requires `next@16.2.9` (two major versions up)
  - High: `glob` (transitive, via `@next/eslint-plugin-next` →
    `eslint-config-next`) — CLI command injection — devDependency-only
    (lint tooling, never shipped to the running app); fix tied to the same
    `next`/`eslint-config-next` v16 upgrade
  - Medium: `postcss` (bundled inside `next`'s own `node_modules`) — XSS
    via unescaped `</style>` — same v16 upgrade chain
  - Medium: `uuid` (transitive, via `exceljs`) — missing buffer bounds
    check — fix tied to an `exceljs` major-version change
  - **Major-version upgrades available, not applied** (would require
    dedicated migration/testing effort, all high-blast-radius since they
    touch the framework, UI runtime, or auth): `next` 14→16, `react`/
    `react-dom` 18→19, `eslint` 8→10, `eslint-config-next` 14→16,
    `jose` 5→6 (session signing — auth-critical), `typescript` 5→6,
    `tailwindcss` 3→4 (config-format breaking), `zod` 3→4 (used directly
    in PM Record's `schemas.ts`), `@types/node` 20→26, `@types/react`
    18→19, `@types/react-dom` 18→19, `react-leaflet` 4→5, `recharts` 2→3
  - **Informational**: `npm install` flags `unrs-resolver@1.12.2` (a
    transitive devDependency of `eslint-config-next`, lint-tooling only,
    never shipped) as having an unreviewed install script under npm's
    `allow-scripts` feature. Not a known vulnerability (no CVE) — noted
    for manual review (`npm approve-scripts`), not auto-approved here.
  - No deprecated-package warnings surfaced from a fresh `npm install`.

Fixed in M6.5 (one genuine release blocker found during the final review,
fixed under that milestone's narrow "fix only if a genuine blocker exists"
allowance):
- `src/features/pm-record/fetchPmRecord.ts` built its server-to-server
  fetch URL as `NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`.
  `NEXT_PUBLIC_APP_URL` is not set anywhere in this deployment (grepped
  the whole `src/` tree and root `CLAUDE.md`'s environment-variables
  section — it appears nowhere else and isn't documented), so in
  production this would have silently targeted `http://localhost:3000`
  from inside a Vercel serverless function — unreachable, breaking the PM
  Record **detail and edit pages** (both call `fetchPmRecord()`). Fixed
  by falling through to Vercel's automatically-provided `VERCEL_URL` env
  var (no manual configuration needed) before ever defaulting to
  localhost. One file, one function, no architecture change.

Final M6.5 review: READY FOR MERGE. No other genuine release blocker was
found across dependency direction, repository/service abstraction, API/
response contracts, domain model, validation, authorization, persistence,
soft delete, audit fields, testing, documentation, CI, RLS, migration
alignment, security, or performance.

Next Milestone: not yet scheduled
Candidate next tasks (unscheduled, pending explicit direction):
- A dedicated Next.js 14→16 (+ React 18→19) upgrade milestone, given 4 of
  7 audit findings require it — the single biggest remaining risk item
- A future ADR decision on Supabase Auth (or per-request session
  variables) if real RLS-enforced dealer/branch isolation is ever required
- Drop the four unused legacy columns on `pm_records` (cleanup only)
- Extend automated test coverage to other modules (only PM Record has
  tests today)
- PDI/media upload, dashboard/KPI integration, PDF export — none started

Current Blockers:
None — the M6.5 review found and fixed the one genuine release blocker
(above). The live-schema defects noted for M6.1 are already resolved;
the two remaining items above (dead columns, RLS dealer isolation) are
flagged debt, not blockers.

Legacy Naming (tracked, not yet renamed — pending ADR):
- SESSION_COOKIE = 'mqr_session' (lib/auth.ts)
- STORAGE_BUCKET = 'mqr-files' (lib/supabase.ts)
- MqrRecord interface (lib/types.ts)
- Sidebar display name 'Market Quality Report' (sidebar.tsx)

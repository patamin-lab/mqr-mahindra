Current Sprint: Sprint 10
Current Branch: feature/pm-record-workflow-redesign (branched from main after M1-M6.5 merged)
Current Module: PM Record
Current Milestone: PM Program (model-aware PM Interval mapping) Complete
Current Status: In Progress (ad hoc feature between Phase 4a and 4b; Phase
4b/4c and Phase 5 of the production UX redesign not started)

M1-M6.5 (CRUD module, tests, CI, dependency audit, release review) are
merged into `main` (PR #2, merge commit `32c4e29`). Everything below this
line describes the NEW production UX redesign, built on top of that
merged foundation, not yet merged.

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

========================================================
Workflow Redesign — Production UX (KTV reference)
========================================================

Phase 1 (complete, commit `2e3f1cc`): Master Data Foundation
- New `pm_intervals` master table + `/admin/pm-intervals` CRUD page
  (mirrors the existing `problem_codes` admin pattern exactly)
- `vehicles.engine_number`, `vehicles.branch_id` (FK to `branches`) added
  (Tractor Master gets a real home-branch attribute + engine number)

Phase 2 (complete, this commit): Search-First Workflow
- Replaced `/pm-records/new` (was a generic create form) with a search-first
  flow: search Tractor Master (Dealer→Branch cascade, Serial autocomplete
  3+ chars, Customer Name/Phone via PM history join) → Recent Vehicles
  (last 5, localStorage, no new table) → select → auto-fill (dealer/branch/
  serial/engine number/model/retail date; customer name/phone always
  entered fresh, never auto-filled) → enter hour meter/PM interval/
  technician/notes → upload 3 required photos (reuses the existing
  `/api/upload` + Google Drive `_pending`→relocate pattern from QIR,
  unmodified) → pre-save duplicate check (same tractor+interval+date,
  warn-and-continue, never a hard block) → save.
- Business number `PM-[DealerCode]-[Year]-[Running]` generated server-side
  in `SupabasePmRecordRepository.create()`, reusing the existing `job_seq`
  table / `next_job_seq()` RPC that QIR's `job_id` already uses (QIR calls
  it with a global sentinel dealer_id; PM Record calls it with the real
  dealer code, so each dealer gets its own per-year sequence for free —
  zero new migration needed for this part).
- New `pm_records` columns (live migration applied): `engine_number`,
  `hour_meter`, `pm_interval_id` (FK), `pm_number` (unique),
  `meter_photo_url`/`nameplate_photo_url`/`report_photo_url`.
  `customer_name`/`customer_phone`/`model`/`delivery_date` already existed
  on the live table since Sprint 10.1 but were never wired into the
  `PmRecord` TypeScript type until now — no migration needed for those four.
- Detail/list pages updated to show PM number (not the raw UUID — "Do NOT
  expose UUID" per spec) plus the new fields/photos.
- 45/45 tests passing (was 39 - added `findDuplicate` coverage plus fixed
  fixtures for the expanded `PmRecord` shape).

Phase 3 (complete, this commit): GPS, Maps & Location Experience
- Reused the existing Leaflet + Esri World Imagery (satellite) + Nominatim
  stack already used by the QIR report form's location picker, rather than
  introducing real Google Maps JS API (would have required a brand-new
  paid dependency, a new Google Cloud API key, and billing enabled on
  Google's side, none of which exists today) - confirmed with the user
  before proceeding. Esri World Imagery is already satellite tiles, so
  "default satellite layer, not road map" was already true beforehand.
- New reusable components under `src/components/shared/gps/` (PM-Record-
  agnostic, ready for any future module): `GpsMapView` (draggable-marker
  map, or read-only for a detail page), `GpsLocationPicker` (search +
  current-location + map + reverse-geocode display), `reverseGeocode.ts`
  (Nominatim reverse/forward geocoding), `exif.ts` (EXIF GPS reading via
  the new `exifr` dependency - a small, justified, client-only addition;
  hand-rolling binary EXIF/TIFF parsing would have been far more
  error-prone for this one feature).
- Location search accepts a place name, a pasted "lat,lng" pair, or a
  Google Maps URL (parsed directly, no geocoding round-trip) - all three
  forms the spec asked for.
- GPS accuracy displayed (±N m); a warning shows above 30m but never
  blocks Save, since GPS remains fully optional throughout.
- EXIF photo-GPS: uploading any of the 3 required photos checks for
  embedded GPS and offers "use photo location" vs. "keep current" -
  technician chooses, never applied silently.
- New `pm_records` columns (live migration applied): `latitude`,
  `longitude`, `gps_accuracy`, `google_maps_url` - all nullable, no
  address components stored (reverse-geocoded village/subdistrict/
  district/province are display-only, per spec, never persisted).
- Detail page now shows a read-only satellite map, coordinates, accuracy,
  and an "Open Google Maps" button when a location was captured.
- 47/47 tests passing (was 45).

Phase 4a (complete, this commit): History Center (sub-phase 1 of 3 - CSV/
PDF/bulk export deliberately deferred to 4b/4c, agreed with the user
before starting given the phase's overall size)
- Replaced `/pm-records` (was a client-fetched, unpaginated basic list)
  with a server-side paginated/filtered/sorted/searchable History Center -
  never loads the full table into the browser, confirmed via the new
  `GET /api/pm-records/history` route which always paginates (capped at
  200/page) regardless of what's requested.
- New `pm_records` columns (live migrations applied): `technician_name`/
  `branch_name` (snapshot, resolved server-side from the ids at create
  time, mirroring the sibling QIR `records` table's exact existing
  pattern so History search/export never needs a live join) and
  `next_pm_due` (computed from `performed_date + pm_interval.interval_months`
  at create time, month-based intervals only - powers "Overdue"/"Upcoming
  PM" quick filters as a simple indexed date comparison).
- `pg_trgm` extension + GIN trigram indexes on every universal-search
  column (`pm_number`/`serial`/`customer_name`/`customer_phone`/
  `technician_name`/`branch_name`/`model`/`notes`), plus btree indexes on
  `performed_date`/`created_by`/`next_pm_due` - the spec's explicit
  "indexed search" / "100,000+ records" requirement.
- Quick filters (Today/Yesterday/This Week/This Month/Last Month/This
  Year/Overdue/Upcoming PM/Clear), a full Advanced Filter panel (every
  field the spec listed), and one universal search box across all 9
  documented columns via a single `.or()` query.
- Saved Filters: Dealer/Branch/Date/Sort persisted in localStorage per
  username (same lightweight pattern as Phase 2's Recent Vehicles - no
  new table), restored automatically on load.
- History table built on the new `@tanstack/react-table` dependency
  (added deliberately - hand-rolling sort+resize+column-visibility+
  selection reliably would have been far more code): sorting, server-side
  pagination, sticky header, resizable columns, column show/hide, and row
  selection (row / select-all-on-current-page). Bulk action buttons
  (Export CSV/PDF, Download Images) are present and wired to the
  selection state, but disabled with a "coming in 4b/4c" tooltip - there's
  nothing to attach them to yet since those endpoints don't exist.
- 54/54 tests passing (was 47).

PM Program (complete, this commit): model-aware PM Interval mapping,
requested as a standalone ad hoc feature between Phase 4a and 4b
- New `pm_programs` table (live migration applied): maps a Tractor Model
  (free text) to a PM Interval, many-to-many, unique per pair. Deliberately
  NOT soft-deleted like other master data - it's a pure junction table
  with no standalone business/audit value, so unchecking a model in the
  admin UI does a real delete.
- "Tractor Model" reuses the existing `vehicles.model` distinct values
  (confirmed real, populated data live) rather than inventing a new Models
  Master table - none exists today, and creating one would duplicate
  master data unnecessarily. New models synced in via the existing
  Tractor IN sheet flow appear automatically in the admin checklist, no
  code change needed, per spec.
- New admin page `/admin/pm-programs` ("PM Program" in the sidebar, under
  Master Data, central-role-gated like PM Interval/problem codes): one
  row per PM Interval with a checkbox grid of every known model, saved
  per-interval via `PUT /api/admin/pm-programs/:pmIntervalId` (replaces
  the full mapped-model set for that interval).
- `GET /api/pm-intervals` (used by the PM Record create form) now accepts
  an optional `?model=` filter; the create form passes the selected
  vehicle's model automatically, so the PM Interval dropdown only shows
  intervals mapped to that tractor's model. A model with no configured
  mapping yet correctly shows zero options (with an inline hint pointing
  to the admin page), matching the spec's literal "only intervals mapped
  to that tractor model shall be displayed" - not a bug, but worth
  knowing operationally: every model needs at least one PM Program
  mapping configured before technicians can record a PM for it.
- 54/54 tests unaffected (no PM Record Repository/Service contract change
  - this feature lives entirely in `lib/db.ts`'s existing plain-function
  master-data pattern, matching problem_codes/pm_intervals).

Phase 5a — Vehicle 360 + Vehicle Life Cycle timeline (complete, this commit)

Business context: the app is evolving from a single MQR module into the
"Mahindra After Sales Platform," with Vehicle 360 as the intended single
source of truth for a tractor across its whole lifecycle (Factory → Dealer
Receive → PDI → NTR → Maintenance → MQR → Campaign → Parts Request). Note:
this platform-wide direction is a *separate, still-documentation-only*
initiative already tracked in `docs/ROADMAP.md` (Sprints 1-5, "modules/" and
"shared/" scaffolding) - this feature does not move any code into that
structure; it's new business logic added directly under `src/`, matching
how PM Record itself was built.

Two scope decisions made with the user before implementing (see chat):
- The full spec's timeline sources PDI/NTR/Campaign/Parts Request events -
  none of those modules exist in this codebase, and `docs/ROADMAP.md`
  explicitly flags NTR's scope as "Unanswered - do not design against a
  guess." Built the generic event contract/architecture now, but wired in
  real events from only the two modules that actually exist today
  (Maintenance/PM Record, MQR). Future modules register by adding one
  function to `registry.ts` - no other file changes.
- The spec's Maintenance Program (hour/month due engine keyed off Product
  Family) is deferred to Phase 5b - Product Family doesn't exist as a
  concept anywhere in the schema yet, and reworking PM Program (just
  shipped) into it is real, separate schema/migration work. Phase 5a's
  "Current Maintenance Status"/"Next Maintenance" fields reuse the
  existing simple `next_pm_due` date comparison from Phase 4a's quick
  filters (month-based intervals only) as a placeholder, explicitly noted
  as superseded once the real Due Engine lands.

What was built:
- New `src/features/vehicle-360/` module: `types.ts` (`VehicleEvent`,
  `VehicleEventSource` contract, `Vehicle360Header`), `registry.ts` (the
  one file future modules touch), `eventSources/maintenanceEvents.ts` and
  `eventSources/mqrEvents.ts` (each module's own scoped read, reusing
  `PmRecordService.listHistory()` and the existing `getVehicleHistory()`
  rather than any new direct Supabase query), `service.ts`
  (`getVehicle360Header()` + `getVehicleTimeline()` - aggregation only,
  never persists anything of its own).
- New page `/vehicles/[serial]` (Vehicle 360): vehicle info, owner info
  (newest customer name/phone snapshot across Maintenance/MQR), dealer,
  branch, retail date, engine number, current hour meter, maintenance
  status badge (Normal/Due Soon/Overdue/None), next maintenance date,
  vehicle status (Normal / มีงานค้าง from any open MQR job) - plus the
  Vehicle Life Cycle timeline itself, sorted newest-first, each row
  linking back to its originating PM Record or MQR detail page.
- New page `/vehicles` (serial search entry point) + sidebar nav entry
  "Vehicle 360" - satisfies the spec's "Accessible from Serial Number"
  bullet independent of drilling in through another module first.
- Entry-point links added from the other required surfaces: PM Record
  detail page, PM Record History table's Serial column, MQR records list,
  MQR record detail page, and the Dashboard's Top Aging Jobs table.
- Added `getBranchById()` to `lib/db.ts` (mirrors the existing
  `getDealer()` pattern) and `branch_id` to the `Vehicle` type - both were
  missing even though the column has existed since Phase 1.
- Added a `typecheck` script to `package.json` (`tsc --noEmit`) - root
  `CLAUDE.md` already documents `npm run typecheck` as a required pre-PR
  step, but the script itself didn't exist yet.
- 54/54 existing tests unaffected (no PM Record Repository/Service
  contract change - Vehicle 360 only reads through existing service
  methods).

Not started (Phase 5b/5c, Phase 4b/4c):
- Phase 5b: Maintenance Due Engine (hour-based + month-based, Remaining
  Hours/Remaining Days, Normal/Due Soon/Overdue with color), plus the
  Product Family master data + migrating PM Program from model-based to
  Product-Family-based mapping.
- Phase 5c: Service Intelligence Dashboard (Executive/Dealer/Technician/
  MQR/Campaign KPI sections) + Global Search (serial/engine/PM number/MQR
  number/customer/phone/dealer/branch, one box).
- Phase 4b: CSV export (column selection) + Summary PDF + Individual PDF
  (GPS + QR + 3 photos) - reusing the existing `exportPdf.tsx`/`qrcode`/
  `papaparse` patterns already established for QIR, per spec's "reuse
  existing PDF/Export Service" instruction
- Phase 4c: Bulk PDF + ZIP image download (needs a new `jszip`-type
  dependency, not yet added) + image viewer (fullscreen/zoom/next-prev).
  Note: true ">1000 records → async job with a Download button later"
  isn't achievable without new background-job infrastructure (no queue/
  worker exists in this Vercel-serverless-only app) - agreed with the user
  to implement bulk export as a single long-running, capped request
  instead ("Preparing Report..." while the one request completes)

Next Milestone: Phase 5b (Maintenance Due Engine + Product Family) or
Phase 5c (Dashboard + Global Search) or Phase 4b/4c - pending explicit
direction
Candidate next tasks (unscheduled, pending explicit direction):
- Phase 5b/5c/4b/4c above
- A dedicated Next.js 14→16 (+ React 18→19) upgrade milestone, given 4 of
  7 M6.4 audit findings require it — the single biggest remaining risk item
- A future ADR decision on Supabase Auth (or per-request session
  variables) if real RLS-enforced dealer/branch isolation is ever required
- Drop the four now-genuinely-unused legacy columns on `pm_records`
  (`model`/`delivery_date` are now used as snapshot fields, so only
  cleanup candidates remain if any are found to still be truly dead)
- Extend automated test coverage to other modules (only PM Record has
  tests today)

Current Blockers:
None. This redesign branch has not been merged to `main` yet — pending
explicit direction on when/whether to open that PR (deliberately separate
from the M1-M6.5 merge, since this is new, unreviewed, unreleased work).

Legacy Naming (tracked, not yet renamed — pending ADR):
- SESSION_COOKIE = 'mqr_session' (lib/auth.ts)
- STORAGE_BUCKET = 'mqr-files' (lib/supabase.ts)
- MqrRecord interface (lib/types.ts)
- Sidebar display name 'Market Quality Report' (sidebar.tsx)

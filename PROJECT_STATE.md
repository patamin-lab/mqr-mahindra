Current Sprint: Production Stabilization Sprint
Current Branch: feature/pm-record-workflow-redesign (branched from main after M1-M6.5 merged)
Current Module: MQR + PM (both)
Current Milestone: Production Stabilization Sprint Complete (12 milestone commits)
Current Status: Complete - see "Production Stabilization Sprint" section below.
Awaiting explicit direction on next work; branch not yet merged to main.

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

Phase 4.5 — Platform Event Framework (complete, this commit)

Business context: Vehicle Event is being promoted from "something Vehicle
360 reads at query time" (Phase 5a's `src/features/vehicle-360/registry.ts`
approach) to a real Platform Service every module writes through - the
backbone the whole Mahindra After Sales Platform is meant to run on.
Confirmed with the user before implementing: this phase is infrastructure
only (schema + Repository + Service + Publisher + API + tests) - it does
NOT touch Vehicle Timeline/Vehicle 360/Dashboard, and it does NOT wire
PM Record's or MQR's existing create()/update() code to actually call the
publisher yet. `publish*()` exists and is fully tested in isolation, but no
real module calls it today - Phase 5a's Vehicle 360 page still reads via its
own registry, unchanged. Wiring real call-sites (and migrating Vehicle 360
to read from `vehicle_events` instead) is deliberately deferred.

Architecture (per spec, replacing "Module -> Repository -> Database"):
Module -> Domain Service -> `VehicleEventPublisher` -> `VehicleEventService`
-> `VehicleEventRepository` -> Supabase. No module may write directly into
`vehicle_events` - the Publisher is the only entry point (even
`/api/platform/events` POST goes through `publisher.publish()`, not
`VehicleEventService.createEvent()` directly, for the same reason).

What was built (live migrations applied, both explicitly confirmed with the
user beforehand):
- `event_definitions` - the Event Definition Master, seeded with all 16
  codes from the spec (FACTORY_BUILD, DEALER_RECEIVED, PDI_COMPLETED,
  NTR_COMPLETED, MAINTENANCE_COMPLETED, MQR_OPENED, MQR_CLOSED,
  CAMPAIGN_ASSIGNED, CAMPAIGN_COMPLETED, PART_REQUESTED, PART_DELIVERED,
  INSPECTION, SOFTWARE_UPDATE, RECALL, TELEMATICS_ALERT, OTHER).
- `vehicle_events` - `vehicle_id` (FK to `vehicles.id`, resolved server-side
  from a serial at publish time - never a live Supabase read from client
  input), `event_definition_id` (FK - the table always stores this, never
  the `event_code` string, per spec's Reference Integrity section),
  `source_module`/`reference_id` (how Vehicle Timeline opens the originating
  module later), `event_datetime`/`title`/`description`/`metadata` jsonb/
  `status`, full audit trail, and `record_status`/`deleted_by`/`deleted_at`
  soft delete (added beyond the spec's literal column list, matching every
  other table's convention in this app). Indexed on vehicle_id,
  event_datetime, event_definition_id, source_module per spec.
- New `src/features/vehicle-event/` module: `types.ts`, `schemas.ts`/
  `validation.ts` (zod, mirrors `pm-record`'s pattern - duplicated rather
  than cross-imported, since `shared/` isn't wired up yet, per
  `docs/ARCHITECTURE.md`), `repository.ts`/`supabaseRepository.ts`
  (`createEvent`/`updateEvent`/`deleteEvent` (soft delete only)/
  `getVehicleEvents`/`getModuleEvents`/`searchEvents`/
  `getEventDefinitionByCode`), `service.ts` (validates, then delegates),
  `publisher.ts` (`publish()` generic + the 9 named convenience methods
  from the spec: `publishMaintenanceCompleted`/`publishNtrCompleted`/
  `publishPdiCompleted`/`publishMqrOpened`/`publishMqrClosed`/
  `publishCampaignAssigned`/`publishCampaignCompleted`/
  `publishPartsRequested`/`publishPartsDelivered` - each resolves serial ->
  vehicle_id and eventCode -> event_definition_id, then builds a
  `VehicleEventCreateInput` with only a metadata snapshot, never a copy of
  the calling module's actual business record), `factory.ts` (real-dependency
  wiring for the API route and any future module).
- `vehicle_events` has no `dealer_id` column of its own (per spec's column
  list) - `/api/platform/events` GET enforces dealer scope via a
  `vehicles!inner(dealer_id)` embedded-resource join instead of a stored
  column, same "every query enforces dealer scope" rule every other table
  in this app follows; a non-privileged caller is pinned to their own
  dealer regardless of the `vehicleId`/`serial` query params they send.
- `/api/platform/events` - GET (paginated/filtered search, dealer-scoped),
  POST (routes through the Publisher - callers identify the vehicle/event
  by `serial`/`eventCode`, never internal uuids), PUT (partial patch via
  the Service), DELETE (soft delete via the Service). Response contract
  matches PM Record's `{ok,data}`/`{ok:false,error:{code,message}}` (new
  code, not the legacy admin string-error shape).
- 65 new tests (repository/service/publisher/API, incl. soft-delete
  invariant and dealer-scoping join tests) - 119/119 total passing.

Phase 5b — Product Family, Maintenance Program, Maintenance Due Engine &
Vehicle Health Engine (complete, this commit)

Business context: maintenance scheduling must depend on Product Family, not
individual Tractor Model - "Tractor Model remains for identification only."
This phase replaces the model-based PM Program (Phase 4.5 predates this;
PM Program itself shipped just before Phase 5a) with a Product Family
hierarchy, and introduces the reusable Maintenance Due/Health Engines the
spec calls for as Platform Services. Two decisions confirmed with the user
before implementing (see chat):
- PM Program (model-based, 0 rows in production either way) was fully
  removed - admin page, nav entry, and API routes deleted - rather than
  left in place unused, since the new hierarchy explicitly forbids
  maintenance logic depending on Tractor Model directly and having two
  overlapping "which interval applies here" screens would be confusing.
- Once a vehicle's hour meter passes every explicitly configured stage in
  its Product Family's Maintenance Program (e.g. past 1000 Hr on OJA
  Compact's 50/250/500/1000 Hr program), the Due Engine repeats the gap
  between the last two configured stages indefinitely, anchored on the
  actual last-serviced hour meter/date (not the nominal stage threshold) -
  so a vehicle can still correctly show Overdue if it goes unserviced past
  a repeat cycle, rather than either freezing at the last real milestone or
  perpetually appearing "not yet due."

What was built (all three new tables applied via confirmed live migrations):
- `product_families` (code/name/description/active/audit) - the Product
  Family Master.
- `product_family_models` (model -> product_family_id, unique per model -
  "every tractor model belongs to one Product Family," unlike the
  many-to-many mapping below).
- `maintenance_program_assignments` (product_family_id <-> pm_interval_id,
  many-to-many, real-delete junction table - replaces the old `pm_programs`
  table, which is left in place unread rather than dropped). `pm_intervals`
  itself is reused as-is for the "Maintenance Program" master (it already
  had label/interval_hours/interval_months/active - exactly what was
  needed), per the spec's own "extend safely instead of replacing" rule -
  no new `maintenance_programs` table was created.
- `listActivePmIntervals(model?)` (used by the PM Record create form) now
  resolves Product Family -> Maintenance Program Assignment instead of
  Model -> PM Program - the public function signature still accepts a
  `model` string (that's what the UI actually knows), but the resolution
  path underneath goes through Product Family, never directly.
- New admin pages (Settings -> Master Data): `/admin/product-families`
  (Product Family CRUD), `/admin/product-family-models` (per-model
  dropdown assigning its one Product Family), `/admin/maintenance-programs`
  (per-interval checkbox grid of Product Families - replaces the deleted
  PM Program screen, same UX pattern, Product-Family-keyed instead of
  model-keyed).
- New `src/features/maintenance-due/` - `MaintenanceDueService` (pure
  calculator, no Supabase access): resolves current/next maintenance stage,
  remaining hours/days, status (Normal/Due Soon/Overdue/None) + color +
  score, and Maintenance Compliance (completed-vs-expected stage count),
  from Maintenance Program stages + maintenance history the caller
  supplies. Supports hour-only, month-only, and combined-on-one-stage
  rules ("whichever comes first" governs overall status). 17 unit tests.
- New `src/features/vehicle-health/` - `VehicleHealthService` (pure
  calculator): deterministic 0-100 scoring per the spec's rule table
  (completed-on-schedule/no-overdue/no-open-MQR/no-pending-campaign/
  within-interval/no-repeated-MQR bonuses; overdue/per-open-MQR/repeated-
  MQR/per-campaign/incomplete-photos/missing-GPS penalties), clamped to
  [0,100], mapped to Excellent/Good/Attention/Critical via named threshold
  constants (not hardcoded in any UI component, per spec - "must be
  configurable later"). Explicitly NOT AI - a fixed rule table. Pending
  Campaign Count is always 0 (no Campaign module exists in this codebase
  yet); "repeated MQR" uses a documented 90-day lookback constant
  (`REPEATED_MQR_WINDOW_DAYS`). 9 unit tests.
- New `src/features/vehicle-summary/` - `VehicleSummaryService`
  (orchestration only): resolves Product Family, loads its Maintenance
  Program stages, loads maintenance/MQR history through the same
  module-owned reads Vehicle 360's Timeline already used (Phase 5a's
  `fetchMaintenanceRecords`/`fetchMqrRecords` - no new duplicate queries),
  then delegates all business-rule computation to the two engines above.
  Not unit-tested directly (matches this codebase's existing convention -
  `vehicle-360/service.ts`'s prior header-aggregation code was never unit
  tested either; the business-logic-heavy engines it wires together are
  the ones that get real test coverage).
- Vehicle 360 (`/vehicles/[serial]`) enhanced to show Product Family,
  Maintenance Program, Last/Next Maintenance, Remaining Hours/Days,
  Maintenance Status (color-coded), Health Score + Status, Maintenance
  Compliance (X/Y, %), Open MQR Count, Pending Campaign Count - still
  "aggregate and display only," per spec; the old `Vehicle360Header`/
  `getVehicle360Header` (Phase 5a) were removed from
  `vehicle-360/types.ts`/`service.ts` in favor of `VehicleSummaryService`,
  which now owns that responsibility. `vehicle-360/service.ts` now
  contains only `getVehicleTimeline()` - Timeline still reads from events
  only, never computes Due/Health/Compliance itself.
- 26 new tests (Due Engine + Health Engine) - 140/140 total passing.

Architecture Refactoring — Maintenance Domain Standardization (complete,
this commit)

Purely a technical reorganization - "no new business functionality," per
spec, and confirmed with the user beforehand: only the Maintenance
(formerly `pm-record`) module and the Vehicle 360 aggregation layer were
touched; MQR, Dashboard, master-data admin CRUD, and `vehicle-event` (the
Phase 4.5 platform framework) are untouched, since re-homing any of those
is separately tracked in `docs/ROADMAP.md`'s own future Phase 2/3.
Business-facing wording is unchanged everywhere ("PM Record"/"PM
History"/"PM Interval" in the UI); only the technical/code layer renamed.
Database table (`pm_records`) and API routes (`/api/pm-records/*`,
`/pm-records/*` pages) are unchanged - zero destructive changes,
zero URL breaks.

What changed:
- `src/features/pm-record/` -> `src/features/maintenance/`, restructured
  into `types/`, `schemas/`, `repositories/`, `services/`, `utils/`,
  `components/`, `tests/` subfolders. Renamed: `PmRecordService` ->
  `MaintenanceService`, `PmRecordRepository`/`SupabasePmRecordRepository`
  -> `MaintenanceRepository`/`SupabaseMaintenanceRepository`,
  `fetchPmRecord()` -> `fetchMaintenance()`, `PmRecord` ->
  `MaintenanceRecord` (+ every `Pm*` type - `MaintenanceRecordCreateInput`/
  `UpdateInput`, `MaintenanceHistoryFilter`/`Result`/`SortField`/`SortDir`,
  `MaintenanceDuplicateCheckParams`), UI components (`MaintenanceSearch`/
  `MaintenanceCreateForm`/`MaintenanceHistory`/`MaintenanceGpsDetail`/
  `MaintenanceForm`/`MaintenanceDeleteButton`). Added `MaintenanceStage`/
  `MaintenanceProgram`/`MaintenanceAttachment` types per spec's "Types"
  list (the latter derived from the existing 3 flat photo-url columns via
  `maintenanceAttachmentsOf()`, not a storage restructure).
- `src/features/vehicle-360/` -> `src/features/vehicle/`. Introduced the
  Vehicle Summary Architecture: `VehicleSummaryProvider` interface
  (`vehicle/types.ts`) - "Vehicle360 must never directly depend on
  business repositories... each module implements its own provider."
  `MaintenanceSummaryProvider` (`maintenance/providers/`) and
  `MqrSummaryProvider` (new, minimal `src/features/mqr/providers/` -
  the MQR module itself was NOT moved; this one small adapter file reads
  through the existing, unmodified `getVehicleHistory()`) are registered in
  `vehicle/providers/registry.ts` - the only file a future module
  (PDI/NTR/Campaign/Parts Request/...) needs to touch to contribute to
  Vehicle 360.
- The old monolithic `VehicleSummaryService` (Phase 5b) was retired -
  its logic split across the two providers above plus a thinner
  `vehicle/service.ts`, which now: resolves only core vehicle identity
  itself (dealer/branch/model - nobody's business data), collects each
  provider's contribution via a generic merge (first provider in registry
  order to set a non-null field wins), and computes Health Score itself
  (the one genuinely cross-module calculation, needing both Maintenance's
  and MQR's signals - not owned by either provider alone).
  `vehicle/service.ts`'s `getVehicleTimeline()` is byte-for-byte unchanged
  from Phase 5a.
- One accepted, minor behavior nuance from this restructuring: `ownerName`/
  `ownerPhone` resolution changed from "whichever module's record is
  chronologically newer" (Phase 5a/5b) to "whichever registered provider
  runs first and has a non-null value" (Maintenance, then MQR) - the
  provider abstraction no longer gives the aggregator visibility into raw
  record dates across modules. Flagged here rather than silently changed.
- `docs/DEVELOPMENT_GUIDE.md` and `docs/NAMING_STANDARD.md` updated to
  reference the new `maintenance` technical name where they cited the old
  `pm-record` path; `AI_CONTEXT.md` needed no changes (it only ever used
  the business term "PM Record", never a technical path).
- Zero test changes needed beyond updating import paths/mock targets to
  match the moved files - all business logic and assertions are identical.
  140/140 tests still passing.

Not started (Phase 5c, Phase 4b/4c):
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

========================================================
Production Stabilization Sprint (complete, this commit series)
========================================================

Business context: stop expanding platform surface area and make MQR +
PM production-ready for daily dealer use - explicitly no Dashboard/
Analytics/AI/Notification/Offline/PWA/Calendar/Work Order/Platform
Services work this sprint. Started with two parallel audit agents (one
per module) reading the actual code against an explicit checklist
(Report Creation/Investigation/Attachments/PDF/CSV/Search/Performance/
Security for MQR; Search-first/Maintenance Engine/Attachments/History/
PDF/CSV/Search/Validation for PM), then four architecture decisions
confirmed with the user before implementing (MQR status enum: extend,
don't rename; MQR audit trail: system-logged history only, no comments/
chat; PM Maintenance Program: full immutable versioning, not just a
per-record snapshot; PM lock rules: time+supersession based, with a
temporary Central/SuperAdmin override, not a new Draft/Locked status
field). 12 milestone commits, each independently verified (typecheck/
lint/build/full test suite) before commit, per the sprint's own
"verify after EACH milestone" instruction. 213/213 tests passing at the
end (was 168 at the start of this sprint), all in this shared platform/
module code - `records`/`admin/*`/`report` UI components still have no
automated coverage, same documented gap as before.

MQR (Part A) — completed:
- **Investigation workflow**: added the two genuinely missing business
  states (`WaitingCustomer`, `Rejected`) to the existing 6-status enum
  without renaming `UnderInvestigation`/`Repaired`/etc to match another
  spec's wording (`records_status_check` constraint extended, live
  migration). Added `MQR_STATUS_TRANSITIONS`/`canTransitionMqrStatus()`
  (`lib/types.ts`) - a real state-machine graph enforced in
  `updateRecord()`, not just a free-form status dropdown; SuperAdmin
  retains an unconditional override (e.g. to reopen a wrongly-closed
  job), every other status-updating role must follow the graph. Status
  dropdown UI filters to only valid next-states.
- **Audit trail**: new shared `record_audit_log` table (module-scoped
  `'mqr'|'pm'`, no UPDATE/DELETE RLS policy at all - immutable by
  database construction, not just convention) plus
  `logAuditEvent`/`logAuditEvents`/`listAuditLog`/`diffFieldsForAudit`
  in `lib/db.ts`. Wired into `createRecord`/`updateRecord`/
  `softDeleteRecord` (status changes, severity changes, RCA field
  edits, attachment add/remove, create, delete); a read-only Timeline
  section now renders on the record detail page. This same table is
  reused by PM's lock/unlock/delete events below - one shared audit
  mechanism, not two.
- **Search/pagination**: `listRecords()`'s `.limit(500)` silently
  truncated any dealer/period with more than 500 records with zero
  indication to the user - a real, invisible data-loss-in-view bug.
  Replaced the records list page with `listRecordsPaginated()`
  (`range()`-based, real total count, Prev/Next pager); `listRecords()`
  itself untouched since bulk export still needs the whole matching set.
  Added a `found_date` range filter and broadened free-text search to
  branch_name/technician_name/problem_code.
  `records.gps_accuracy`/`google_maps_url` added (live migration) so
  the richer picker's data isn't discarded.
- **Attachment framework**: extracted the size-routed upload logic
  (proxy ≤4MB, chunked Drive relay above it) into
  `components/shared/upload/uploadFileSmart.ts`; the record update
  form previously always proxied directly with no >4MB path (a real
  gap - a large after-repair photo could silently fail against
  Vercel's body cap), now uses the same shared uploader as the report
  form. Swapped MQR's own local GPS picker
  (`report/location-picker.tsx`/`map-view.tsx`, deleted) for the
  shared `components/shared/gps/GpsLocationPicker` PM already used -
  one GPS implementation, not two.
- **PDF**: `lib/pdf/PdfBrandLogo.tsx` - a reusable logo slot reading
  from `public/assets/branding/mahindra-logo.png` (configurable path,
  never hardcoded per-document); no logo asset exists yet, so it
  reserves a correctly-sized blank slot rather than fabricating a
  placeholder image, per explicit instruction - drop the real PNG in
  and every PDF (MQR + PM) picks it up automatically, no code change.
  Photo sections now render only when a category actually has photos
  (previously every one of the 8 `PHOTO_CATEGORIES` printed an empty
  "no photo" box, including legacy categories no new record ever
  populates).
- **CSV**: `lib/exportCsv.ts` - shared `buildCsv()` (UTF-8 BOM,
  proper comma/quote/newline escaping, CRLF) + `buildRecordsCsv()`.
  `GET /api/records/export?format=csv` + an Export CSV button on the
  list page.
- Font registration (`ensureFontsRegistered`) and the remote-image
  resolver (`fetchImageAsDataUri`) were extracted out of
  `lib/exportPdf.tsx` into `lib/pdf/fonts.ts`/`fetchImage.ts` so PM's
  new PDF (below) reuses the exact same hardened implementation
  instead of a second copy - both documents' prior bug-fix history
  (Deployment Protection font-fetch workaround, Drive-thumbnail
  fetch-failure hardening) stays in one place.
- Security/Performance: audited, no changes needed - dealer isolation,
  soft delete, and audit-field handling were already correct
  everywhere in this module.

PM (Part B) — completed:
- **Maintenance Program Versioning**: the Due/Compliance/Health
  engines previously recomputed against the *current* live
  `maintenance_program_assignments` set for a Product Family - editing
  a family's stages after vehicles already had history would silently
  reclassify already-completed stages as incomplete, with no record of
  what applied at the time. New `maintenance_program_versions`/
  `_stages` (immutable snapshots) + `vehicles.maintenance_program_
  version_id` (permanent pin, resolved once against whichever version
  was effective at the vehicle's retail date, falling back to the
  earliest version if retail date predates all of them). A stale pin
  (the vehicle's Product Family itself was reassigned since) is
  detected and re-resolved, never trusted blindly.
  `syncMaintenanceProgramVersion()` creates a new version only when a
  family's *resolved* stage list actually changed (idempotent),
  called after both admin mutation paths that can affect it
  (assignment add/remove via `/admin/maintenance-programs`, and
  editing an already-assigned interval's own hours/months via
  `/admin/pm-intervals`). `MaintenanceSummaryProvider` now resolves
  through the pinned version, never the live set; Vehicle 360 displays
  the version number in effect.
- **Lock rules & supersession**: PM records had no lifecycle status and
  no lock rules at all - any field could be edited or the record
  deleted at any time, silently changing Due/Compliance/Health for
  that vehicle. Enforced solely in the Service layer (UI disables
  fields only for UX, never the trust boundary): 24h editable window
  after creation, then locked (`edit_window_expired`); creating a new
  record for a vehicle automatically locks every other active record
  for that vehicle no longer the most recent one (`superseded`); only
  `serial`/`performed_date`/`hour_meter`/`pm_interval_id` (the
  calculation-affecting fields) are blocked, notes/attachments stay
  editable; soft-deleting a locked record requires SuperAdmin + a
  mandatory reason (`pm_records.deleted_reason`); Central/SuperAdmin
  may open a temporary unlock window (default 24h,
  `POST .../[id]/unlock`) or explicitly lock a record
  (`POST .../[id]/lock`) - once an unlock window expires the record
  reads as locked again with reason `manual_override` rather than
  reverting silently. Every lock/unlock/delete/field-change event
  writes to the shared `record_audit_log`.
- **PDF/CSV**: PM had neither - confirmed as the two largest blockers
  in the audit (History Center's export buttons were disabled
  "coming in Phase 4b/4c" stubs). New `maintenancePdf.tsx`
  (single-record + bulk-list documents, reusing MQR's now-shared font/
  image/logo infrastructure) and `maintenanceCsv.ts` (reuses
  `lib/exportCsv.ts`'s `buildCsv()`). `GET /api/pm-records/[id]/export`
  (single record) and `GET /api/pm-records/history/export?format=
  pdf|csv` (current filter set, capped at 2,000 records across
  paginated fetches - a deliberate ceiling, not a silent truncation)
  with real Export buttons on the detail page and History Center.
  True "export only the selected rows" (the History Center's
  row-selection UI) remains a disabled, explicitly-labeled stub -
  filter-based export was judged sufficient for this sprint's literal
  checklist ("PDF History"/"CSV History"), selected-rows export is a
  distinct, smaller feature not yet built. Bulk photo ZIP download
  also remains deferred (would need a new `jszip`-class dependency,
  already flagged as out of scope in Phase 4c's own prior scoping).
- **Fixed a real zero-leakage bug** found in the audit: a
  branch-restricted `DealerUser` could see a sibling branch's PM
  records by passing an explicit `?branchId=` query param - the
  session-based `branchName` scoping fallback only ever applied when
  `branchId` was *absent*, never validated against one that was
  present. Extracted the History Center's filter-parsing (shared by
  the paginated list route and the new export route) into
  `parseHistoryFilter.ts`, fixing this once for both.
- **Fixed `pm_interval_id` trust gap**: the create form only ever
  offers intervals filtered by the vehicle's resolved Product Family,
  but nothing re-validated that server-side - a client could POST any
  interval id. `POST /api/pm-records` now re-checks against
  `listActivePmIntervals(model)` when a model is known.
- Standardized `created_at`/`updated_at` on the PM detail page to go
  through `formatThaiDateTime()` (was rendering the raw ISO string,
  a direct violation of this repo's own binding §8.1 rule) and added
  a neutral status badge matching MQR's header treatment.

Explicitly deferred (documented, not silently dropped):
- The Mahindra logo image itself - `PdfBrandLogo`/`public/assets/
  branding/mahindra-logo.png` are ready, no code change needed once
  supplied.
- History Center "export selected rows only" and bulk photo ZIP
  download (see above).
- Everything on the sprint's own STOP list (Dashboard, AI, Platform
  Services, Dealer KPI, Analytics, any new module).

Next Milestone: none scheduled - awaiting explicit direction.
Candidate next tasks (unscheduled, pending explicit direction):
- Phase 5c (Dashboard + Global Search) or Phase 4b/4c's originally-listed
  remainder (bulk PDF/ZIP image download, image viewer)
- Wire PM Record's create() and MQR's create()/status-close to actually
  call `VehicleEventPublisher` (Phase 4.5 built the framework but
  deliberately didn't wire any real call-site), then migrate Vehicle 360's
  timeline (`src/features/vehicle/registry.ts`, renamed from
  `vehicle-360/` in the Architecture Refactoring pass) to read from
  `vehicle_events` instead of its current live-aggregation approach - two
  separate, explicit decisions, not a silent side effect of a future phase
- Wire the new `pendingCampaignCount`/campaign scoring rules to a real
  Campaign module once one exists - Vehicle Health Engine already has the
  input slot, it's just always 0 today
- A dedicated Next.js 14→16 (+ React 18→19) upgrade milestone, given 4 of
  7 M6.4 audit findings require it — the single biggest remaining risk item
- A future ADR decision on Supabase Auth (or per-request session
  variables) if real RLS-enforced dealer/branch isolation is ever required
- Drop the four now-genuinely-unused legacy columns on `pm_records`
  (`model`/`delivery_date` are now used as snapshot fields, so only
  cleanup candidates remain if any are found to still be truly dead)
- Extend automated test coverage to the remaining modules without any
  (`records`/`report`/`admin/*` UI components - `lib/db.ts`'s MQR
  functions, the new audit log, and status transitions do now have
  coverage as of this sprint, but the React components themselves don't)
- Supply the real Mahindra logo PNG (see "Explicitly deferred" above)

Current Blockers:
None. This redesign branch has not been merged to `main` yet — pending
explicit direction on when/whether to open that PR (deliberately separate
from the M1-M6.5 merge, since this is new, unreviewed, unreleased work).

Legacy Naming (tracked, not yet renamed — pending ADR):
- SESSION_COOKIE = 'mqr_session' (lib/auth.ts)
- MqrRecord interface (lib/types.ts)
- Sidebar display name 'Market Quality Report' (sidebar.tsx)

Phase 5B (Maintenance Intelligence + Machine Domain + Media Platform) —
completed this milestone:

- Maintenance Intelligence (Program/Version/Stage/Due Engine/Compliance/
  Health Engine/Progression/PM Lock) was already fully built as of the
  Production Stabilization Sprint (see above) — nothing further was
  needed there beyond the Machine 360 rename below.
- Machine Domain (ADR-009, `docs/engineering/MACHINE_DOMAIN.md`): new
  `src/features/machine/` facade (`MachineService`/`MachineRepository`)
  over the existing `vehicle/`/`vehicle-event`/`vehicle-health` code
  (untouched — no `VehicleRepository`/`VehicleService` existed to rename).
  `Vehicle360Page` → `Machine360Page`; UI strings updated in both locales.
  `docs/standards/DOMAIN_LANGUAGE_STANDARD.md`'s "Tractor, NOT Vehicle"
  rule explicitly superseded for the aggregation layer — see that doc's
  own updated Business Domain section and ADR-009.
- Attachment & Media Platform (ADR-010, `docs/engineering/
  ATTACHMENT_FRAMEWORK.md`/`MEDIA_PLATFORM.md`): new `src/shared/attachments/`
  (`AttachmentService`, `StorageProvider` implementations for Supabase
  Storage (now primary — previously-dead `STORAGE_BUCKET` = 'mqr-files'
  is now real, with new `SELECT`/`DELETE`/`UPDATE` storage policies added)
  and Google Drive (archive-only)). New `attachments` +
  `attachment_retention_policies` tables (migration
  `create_attachments_platform`). Deliberately deferred: MQR/PM's existing
  Drive-only upload pipelines are NOT migrated onto this platform yet —
  that's each module's own future, explicitly-scoped follow-up (see
  ATTACHMENT_FRAMEWORK.md's "What's deliberately deferred"); Machine 360
  doesn't render an Attachments section yet for the same reason (no
  module writes rows into `attachments` today).

Phase 5B.1 (Attachment Platform Adoption) — completed this milestone:

- MQR migrated: `report-form.tsx` (new report) and the record-update form
  both upload via `uploadAttachment()` (`src/components/shared/attachments/`)
  instead of `uploadFileSmart.ts`/Drive directly; `/api/records` reassigns
  attachments uploaded against a temporary entity ID to the real `job_id`
  once created, marks them business-complete when a job transitions to
  `Repaired`/`Closed` (starts the retention clock), and deletes an
  attachment for real (`AttachmentService.delete()`) when a photo is
  removed on update. `records.photo_links[].attachmentId`/
  `records.video_attachment_id` are new, additive columns — a
  pre-migration record's raw Drive URL still renders unchanged; a
  post-migration record's display URL is resolved fresh, server-side, on
  every page load (`records/[jobId]/page.tsx`), never trusted as a stored
  value (a Supabase signed URL expires, unlike Drive's permanent share
  link).
- PM migrated: `maintenance-form.tsx` (the one shared create+edit
  component) uploads Meter/Nameplate/Report photos the same way;
  `/api/pm-records` reassigns to the record's real `id` and marks
  business-complete immediately (a maintenance visit is a single,
  already-complete event). `pm_records.*_photo_attachment_id` are new,
  additive columns (migration `add_pm_records_photo_attachment_ids`).
  Both the create/edit form and the detail page resolve fresh
  display URLs the same way MQR's does.
- Machine 360 now renders a real Attachments section:
  `MachineService.getMachineAttachments()` aggregates across every module
  that has adopted the platform (today: MQR + PM) by reusing each
  module's own existing "records for this serial" utility, then
  `AttachmentViewer` (new shared component,
  `src/components/shared/attachments/AttachmentViewer.tsx`) renders
  images/PDF/video/audio/Excel/other with Open/Download/Delete actions and
  a click-to-preview overlay — reusable by every module going forward.
- Large-file uploads (MQR's video attachment, previously Google Drive's
  resumable-upload dance) now use a Supabase Storage signed-upload-URL
  flow (`AttachmentService.initDirectUpload()`/`finalizeDirectUpload()`,
  new `/api/attachments/upload/init`+`/finalize` routes) - the browser
  PUTs bytes directly to storage, bypassing Vercel's 4.5MB body cap the
  same way the old Drive resumable flow did.
- Deliberately deferred: nothing currently triggers
  `enqueueArchiveEligible()`/`processArchiveQueue()` on a schedule for
  MQR/PM's now-real attachments - building that periodic trigger is its
  own, explicitly-scoped follow-up (see `docs/engineering/
  ATTACHMENT_FRAMEWORK.md`'s "Adopting this for a new module", step 6).
  PDI has no code in this branch to migrate (a retention-policy row is
  already seeded for it); NTR's Google-Drive-only archive system lives on
  a separate sibling branch (`feature/ntr-legacy-import`) not present in
  this working tree, so reconciling the two systems is future work once
  both branches merge.

Storage Infrastructure (post-Phase-5B.1, pre-Phase-5C) — two
infrastructure-only milestones, no business module touched, no default
switched:

- **Cloudflare R2 provider**: `CloudflareR2Provider` (S3-compatible API via
  `@aws-sdk/client-s3`/`@aws-sdk/s3-request-presigner`, new deps) implements
  `StorageProvider` alongside `SupabaseStorageProvider`/
  `GoogleDriveStorageProvider` - built and unit-tested standalone, not
  constructed by anything by default. `StorageProviderName` gained
  `'CLOUDFLARE_R2'` (additive DB CHECK constraint migration
  `allow_cloudflare_r2_storage_provider`). The `StorageProvider` interface
  itself gained `exists()`/`list()` and renamed `getUrl` → `getSignedUrl` -
  `AttachmentService.getUrl()` (the public method every module calls) is
  unchanged, so no business-module file needed touching.
- **StorageProviderFactory**: `AttachmentService` no longer hardcodes
  `new SupabaseStorageProvider()`/`new GoogleDriveStorageProvider()` in its
  constructor defaults - it now calls
  `StorageProviderFactory.createPrimaryProvider()`/`createArchiveProvider()`,
  which read `STORAGE_PROVIDER`/`ARCHIVE_PROVIDER` (default: Supabase
  primary, Google Drive archive - unchanged from before the factory
  existed, since both env vars are unset everywhere today). See
  `docs/architecture/STORAGE_PLATFORM.md`.
- Next, explicit decision needed before either lands in production:
  whether/when to actually set `STORAGE_PROVIDER=CLOUDFLARE_R2` anywhere,
  and whether/when to migrate MQR/PM's existing attachments onto it - both
  deliberately not done as part of these two milestones.

========================================================
Storage Platform — Status: COMPLETE (frozen baseline)
========================================================

Continuing from "Storage Infrastructure" above, the following milestones
completed the Storage Platform build-out and froze it as the official
MASP Storage Platform baseline. No business module (MQR, PM/Maintenance,
Machine 360) was touched by any milestone in this section; no default
provider was switched anywhere; no production rollout occurred.

Completed (in order):
- **Cloudflare R2 enabled in dev, live-verified** - full attachment
  lifecycle confirmed against a real R2 bucket + Supabase DB.
- **Metadata integrity fix** - a live-testing-caught regression
  (`AttachmentRepository.create()` hardcoding `storage_provider:
  'SUPABASE'` regardless of the actual provider) fixed; the real provider
  name is now threaded through every repository write call site.
- **R2 Production Readiness Review** (`docs/engineering/
  R2_PRODUCTION_READINESS.md`) - 12-category audit; found the bucket was
  publicly readable (critical).
- **Final Production Hardening** - removed every permanent/public URL
  code path from `CloudflareR2Provider`; added object-key sanitization to
  `AttachmentService.buildStoragePath()`.
- **Production Gate Review / infrastructure investigation / Production
  Infrastructure Hardening** - live-reconfirmed the public-URL blocker
  resolved (dashboard-level fix); Cloudflare R2 CORS confirmed as the one
  remaining open infrastructure blocker (Cloudflare-dashboard-level, not
  application code).
- **Storage Hygiene** (`docs/engineering/STORAGE_HYGIENE.md`) -
  `OrphanCleanupService` (five detectable orphan-attachment cases),
  dry-run-by-default cleanup, `/api/attachments/orphan-cleanup`.
- **Storage Operations** (`docs/engineering/STORAGE_OPERATIONS.md`) -
  `StorageHealthService`, `StorageMetricsService`, `StorageAuditService`,
  `StorageScheduler` (callable, not scheduled).
- **Platform Freeze** - architecture review confirmed no dead code, no
  legacy Google Drive path inside the platform, every business module
  depends only on `AttachmentService`, all providers replaceable via
  `StorageProviderFactory`.
- **Platform Freeze & Release** - `docs/release/STORAGE_PLATFORM_RELEASE.md`,
  `docs/architecture/PLATFORM_CONSTITUTION.md`,
  `CHANGELOG_STORAGE_PLATFORM.md`, and this status update published.

Verification at freeze: `eslint` 0 errors (7 pre-existing unrelated
warnings), `tsc --noEmit` clean, `vitest run` 308/308 passing, `next
build` succeeds.

Remaining dashboard tasks (deferred, not part of this platform):
- Phase 5c (Service Intelligence Dashboard + Global Search) - unstarted,
  unrelated to storage, tracked separately above under "Not started".

Production prerequisites before any environment sets
`STORAGE_PROVIDER=CLOUDFLARE_R2`/`ARCHIVE_PROVIDER=CLOUDFLARE_R2`:
1. Configure CORS on the R2 bucket via the Cloudflare dashboard (the
   application's own API token cannot read or write bucket CORS config -
   confirmed via `AccessDenied`).
2. Re-run a live end-to-end verification against that environment's real
   bucket.
3. Explicit, separate approval to switch the default.
4. For archive-side R2 specifically: implement
   `AttachmentService.getUrl()`'s missing signed-URL path for a
   non-Google-Drive archive provider first (`StorageProviderFactory`
   currently rejects `ARCHIVE_PROVIDER=CLOUDFLARE_R2` because this
   doesn't exist).

No prerequisite blocks the parts of the platform already live (Supabase
primary / Google Drive archive) - that path has been in production use
since Phase 5B.1 with no open blocker.

Recommended next phase (unscheduled, pending explicit direction):
- Build `scripts/architecture-check.ts` (or an equivalent CI-enforced
  check) - confirmed not to exist anywhere in this repo during the
  freeze; dependency-direction/boundary rules are enforced by convention
  and code review only today.
- Wire a real cron trigger for `StorageScheduler`/orphan-cleanup, with a
  service credential distinct from the SuperAdmin session check, once
  archive/cleanup automation is explicitly approved.
- Phase 5c (Dashboard + Global Search) or the deferred Phase 4b/4c
  remainder - both independent of the Storage Platform, listed here only
  as the next candidate body of work overall.

(`scripts/architecture-check.ts` above was since built and wired into CI
- see the Architecture Enforcement / Release Preparation / Platform
Baseline Freeze work later in this log.)

========================================================
MASP Platform Foundation v1.0 — STATUS: ACCEPTED
========================================================

Formal acceptance of the Storage Platform baseline, following the
Vercel Preview deployment + live UAT (upload/preview/download/delete/
signed-URL/CORS/large-file/error-handling, all VERIFIED against the
real Preview deployment and independently cross-checked in Supabase -
see that UAT report for full evidence; no regression found, no code
changed).

- **Current Storage Platform: Supabase Storage + Google Drive
  Archive - Production Ready.** This is the path in production use
  since Phase 5B.1, unchanged by any Storage Platform milestone since,
  and the one just live-UAT-verified end-to-end on a Preview
  deployment.
- **Cloudflare R2: Implementation Complete, Production Cutover
  Pending (Preview Environment Configuration).** `CloudflareR2Provider`
  is fully built, unit-tested, and was live-verified against a real R2
  bucket earlier in this platform's build-out (see "Cloudflare R2
  enabled in dev, live-verified" above) - but is not the active
  primary/archive provider anywhere, and the most recent Preview UAT
  confirmed `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/
  `R2_BUCKET` are not yet configured as Preview environment variables
  (so the R2-specific rollback/object-metadata tests were MISSING, not
  FAIL). Cutover remains gated on the same production prerequisites
  listed just above (R2 CORS configuration, R2 Preview/Production env
  vars, a live end-to-end re-verification, and an explicit, separate
  approval to switch `STORAGE_PROVIDER`/`ARCHIVE_PROVIDER`) - none of
  which this acceptance authorizes on its own.

## NTR Legacy Import — Google Drive Decoupling (branch `feature/ntr-legacy-import`, off `feature/ntr-module`)

Google Drive removed from the Legacy Import critical path — see
ADR-008-Google-Drive-Decoupling.md. Drive is now archive-only: a
successful import (`ntr_records`/`vehicles`/timeline/audit rows committed)
no longer depends on Drive being reachable at all.

- Migration `ntr_legacy_import_archive_decouple`: `ntr_import_sessions`
  gains `file_content` (base64 original file, replaces the old
  synchronous Drive upload during preview), `file_checksum`,
  `imported_at`, `archive_job_id`, `archive_attempts`,
  `last_archive_attempt_at`, `archive_error`, `archived_at`. Status
  vocabulary replaced (table had 0 rows in every environment):
  `Pending → Validated → Imported → Archive Pending → Archived |
  Archive Failed` (retryable).
- New Postgres function `commit_ntr_legacy_import_row()` (SECURITY
  DEFINER, pinned search_path) — one RPC call is one transaction:
  Tractor (`vehicles`) + NTR (`ntr_records`) + Timeline (`vehicle_events`,
  reusing the existing `NTR_CREATED`/`NTR_COMPLETED` codes — single event
  vocabulary regardless of ingestion method, provenance recorded in
  `metadata.source`/`metadata.import_session_id` instead of a forked
  vocabulary) + Audit (`record_audit_log`), persistence only, no business
  logic. Exposed to the app via `NtrRepository.commitLegacyImportRow()`.
- `NtrImportService.commit()` calls this once per valid row instead of
  the old sequential `createVehicleManual()` + `NtrService.create()` +
  Drive-upload path; a duplicate-serial race is now a real transactional
  rollback (nothing partial persists), not just a pre-check.
- New `archiveSession()`/`processArchiveQueue()` on `NtrImportService`,
  new `GET/POST /api/ntr/import/archive` routes (SuperAdmin only, same
  gate as every other Legacy Import route), and an Archive Queue section
  added to the existing Legacy Import admin page (retry-per-session +
  process-entire-queue). Upload/Preview/Confirm UI itself is unchanged.
- Out of scope, unchanged: parser, business validation, duplicate
  detection, Preview/Upload UI, NTR business rules.
- Verification: `tsc --noEmit` clean, `eslint` 0 errors (9 pre-existing
  warnings, unchanged), `vitest run` 267/267 passing (was 259 before this
  branch — 8 new Archive Queue permission tests), `next build` succeeds.

## Universal Import Wizard Framework (same branch, `feature/ntr-legacy-import`)

Redesigned the Legacy Import UX into a reusable 5-step wizard
(Download Template → Upload File → Preview & Validation → Confirm Import →
Import Complete) and extracted a generic framework, `src/shared/import/`,
so future modules (Vehicle Master, PM, PDI, MQR, Campaign, Parts) reuse it
without redesigning it — see `docs/engineering/IMPORT_FRAMEWORK.md` for the
full architecture. NTR is the only real consumer today; this is a
deliberate, documented exception to `.claude/rules/01-architecture-boundaries.md`'s
"shared/ only when two modules need it" rule (framework code, not business
logic — the abstraction is unverified against a second caller until one
exists).

- **Template generation** (`ImportTemplateService.ts`): downloadable
  `.xlsx` with Instructions/Data/`_META` sheets (Template Name, Version,
  Module, Generated Date), generic over any module's field definitions.
  New `GET /api/ntr/import/template` (SuperAdmin only).
- **Column mapping** (`ColumnMappingService.ts` + `HeaderNormalizer.ts`):
  alias-based header matching, order-independent - `NTR_IMPORT_FIELDS`
  (`src/features/ntr/services/ntrImportFields.ts`) is the one NTR-specific
  piece; the mapping engine itself has no field knowledge.
- **Parser rewrite** (`ImportParser.ts`): the old fixed-position
  `TEMPLATE_COLUMNS` reader is gone. `ntrImportParser.ts` is now a thin
  adapter over the shared generic sheet reader + `ColumnMappingService` +
  each field's own `parse` function. Fixes the "[object Object]" cell
  defect class at the source (rich-text/hyperlink/formula-result cells are
  now stringified safely, never via a bare `String(cell)`).
- **Header Validation**: `preview/route.ts` now rejects a file with none
  of its required columns recognized at all (`formatUnsupportedTemplateMessage()`,
  "Uploaded file is not a supported import template"), before writing any
  session row - a genuinely malformed/wrong-template file no longer
  produces a wall of confusing per-row failures.
- **Humanized errors** (`ImportErrorFormatter.ts`): technical reasons
  (`Unknown dealer_id "X"`, `Missing X`, the duplicate/race messages)
  rewritten into business language for Step 3/5 and the stored session
  `errors` - falls back to the original text for anything unrecognized.
- **Import History**: session history table gained a "Module" column
  (static `'NTR'` today - `ImportHistoryService.ts`'s fan-out design means
  this becomes real per-provider data with no framework changes once a
  second module exists).
- Out of scope, unchanged per this issue: NTR business rules, Vehicle/NTR
  creation, Timeline, Audit, Google Drive, the Archive Worker.
- Note on scope: this app has no existing dark-mode support anywhere
  (`Card`/`globals.css` are light-only) - the spec asked for
  "dark mode compatible," but adding `dark:` classes to only this one page
  would have produced invisible white-on-white text rather than a real
  feature, so the wizard matches the app's actual (light-only) visual
  system instead. Flagged here rather than silently claimed as done.
- Verification: `tsc --noEmit` clean, `eslint` 0 errors (9 pre-existing
  warnings, unchanged), `vitest run` 284/284 passing (was 267 - 17 new
  tests: `ColumnMappingService`, `ImportErrorFormatter`,
  `ntrImportParser` alias-based regression coverage), `next build`
  succeeds.

## Real-file header aliases and flexible date parsing (same branch, committed - `6d1bcc3`)

Added alias mappings observed in an actual dealer export (serial, model,
mobile, city/state, NTR date) to `NTR_IMPORT_FIELDS`, and extended
`parseImportDate()` to normalize `"31 Oct 2025"`/`DD-MM-YYYY` in addition
to already-ISO dates. 8 new tests (`ntrImportFields.test.ts`). This is
the last commit currently on `feature/ntr-legacy-import` before the
uncommitted work below.

## NTR Historical Import Framework Enhancement + Release Candidate UAT (same branch, uncommitted)

Two milestones, run back to back against the already-complete v1.0
framework above - enhancement, then a full live UAT that found and fixed
real defects in that enhancement. Not yet committed - see this branch's
`git status` for the exact file list (21 files: 12 modified, 9 new).

**Enhancement** - added, using the two files uploaded for this milestone
(an NTR template export and Thailand's real Province/District/Subdistrict/
Postal Code reference data) as source of truth, never assumed:
- Address hierarchy validation (Province → District → Subdistrict →
  Postal Code) against a 7,436-row Thailand address master, loaded once
  into memory (`thaiAddressMasterData.ts`/`ntrAddressValidation.ts`) -
  verified against the exact "district doesn't belong to province"
  example from the milestone brief.
- Configurable Serial Number validation: **Legacy Mode** (default,
  unchanged production behavior - unknown serial auto-creates a Tractor,
  now with an explicit warning) vs. **Strict Mode** (rejects unknown
  serials outright) - a real behavior fork resolved by explicit user
  decision, not guessed.
- In-file duplicate serial detection (previously only cross-file);
  phone/customer-name duplicates as warnings that never block import.
- Retail Date validation (future date; before Manufacturing Year).
- Downloadable `NTR_IMPORT_RESULT.xlsx` (every original column + Status/
  Error Message/Warning, correctable and re-uploadable) and execution
  time reporting.
- No schema changes - `import_mode` is a request parameter, not a stored
  column (the auto-mode classifier correctly blocked a first attempt to
  add one, per this app's standing "confirm before shared-resource
  changes" policy).
- New docs: `docs/import/NTR_HISTORICAL_IMPORT.md` (full spec); corrected
  a real, pre-existing inaccuracy in `docs/standards/NTR_IMPORT_MANUAL.md`
  (claimed positional column parsing - the code has used alias-based
  mapping since the Universal Import Wizard Framework milestone above).

**Release Candidate UAT** - live testing (local dev server + real
Supabase DB, 15+ scenarios, full UI-backed flow, negative tests,
regression checks) found and fixed four genuine defects, none of them
guessed or hypothetical:
1. A new "Unknown Province" message collided with an unrelated existing
   regex in `ImportErrorFormatter.ts`, silently rewritten into a vaguer
   message - reworded to avoid the collision.
2. **Critical**: a 10,000-row file took ~10 minutes to validate (per-row
   sequential `getDealer()`/`getVehicleBySerial()`/`findActiveBySerial()`
   calls - 30,000+ DB round trips). Fixed by bulk-prefetching all three
   into in-memory Maps before the validation loop - confirmed live at
   ~1.3 seconds for the same 10,000 rows.
3. That fix's own regression: one `.in()` query with 10,000 values hit
   Cloudflare's "414 Request-URI Too Large" in front of Supabase - fixed
   by chunking bulk queries into batches of 200, run in parallel.
4. A corrupt/unreadable file upload leaked a raw `jszip` library error as
   an unhandled 500 - now caught and returns a clean, localized 400.
- Verification: `tsc --noEmit` clean, `eslint` 0 errors (9 pre-existing
  warnings, unchanged), `vitest run` 327/327 passing (was 284 - 43 new:
  address validation, import-service mode/duplicate/date/bulk-prefetch
  coverage), `next build` succeeds.
- Final Release Candidate UAT verdict: **PASS - READY TO MERGE**. No
  architecture redesign, no schema redesign, no new business features.

## Merge with `origin/main` + Release Completion Cleanup (this milestone, `feature/pm-record-workflow-redesign`)

Merged `origin/main` (bringing in the NTR Legacy Import work above, by
then already merged to `main` via PR #10) into this branch - 3 real
conflicts (`PROJECT_STATE.md`, `src/locales/en.json`, `src/locales/th.json`),
everything else auto-merged. `PROJECT_STATE.md` resolved by keeping both
completed-milestone sections in full. Locale files resolved by keeping
both sides' new keys plus one real value conflict (`vehicle360`-family
keys: "Machine Registry/Machine 360" vs. an independent "Tractor
Registry/Tractor Profile" naming done on `main`) - decided in favor of
"Machine" terminology since that's what the merged, conflict-free
`docs/standards/DOMAIN_LANGUAGE_STANDARD.md` and the rest of the same
locale object already consistently use. Verified no localization key
lost: flattened key-by-key diff against both parents showed the merged
file's key set exactly equals their union (524 keys each, up from 343/516).
Merge commit `0dc13d3`.

Followed by a release-readiness cleanup pass:
- Resolved `TECHNICAL_DEBT.md` #2 (root `CLAUDE.md` §3's stale "no git
  CLI" deployment section - corrected to describe the real git-CLI-based
  workflow) and #3 (the `RELEASE_CHECKLIST.md`/
  `docs/releases/RELEASE_CHECKLIST_V1.md` naming collision - resolved by
  renaming the former to
  `docs/releases/RELEASE_CHECKLIST_STORAGE_PLATFORM_V2.1.md`).
- `RELEASE_SUMMARY.md` marked with a historical-snapshot banner (it
  described both streams as unmerged/uncommitted, which is no longer
  current) rather than rewritten, to preserve it as a dated record.
- Removed two confirmed-unused asset files (`public/fonts/Sarabun-Bold.woff`,
  `Sarabun-Regular.woff` - only the `.ttf` variants are used, per
  `CLAUDE.md` §2's documented TTF-only reason).
- Full repo audit (dead code, obsolete files, unused deps/imports/assets,
  debug code, TODOs) found: zero unused dependencies, zero
  console.log/debugger/TODO/FIXME left in `src/`, and ~55 exported
  types/interfaces with no external importer - the latter deliberately
  left alone (not deleted) since they're inert type declarations that are
  either a module's intentionally-declared public type surface or part of
  the not-yet-wired Platform Event Framework (`vehicle-event/publisher.ts`
  etc.) already tracked as planned, staged infrastructure elsewhere in
  this document - removing them would delete real, intentional
  forward-looking work, not dead code.
- Noted, not fixed (out of this pass's scope - would need its own
  reviewed milestone): `.eslintrc.json` only extends `next/core-web-vitals`,
  which does not enable `@typescript-eslint/no-unused-vars` - a real gap
  in this repo's ability to catch unused imports/variables going forward.
- Verification re-run after cleanup: `eslint` 0 errors (9 pre-existing
  warnings, unchanged), `tsc --noEmit` clean, `vitest run` 407/407 passing
  (unchanged from pre-cleanup), `next build` succeeds,
  `npm run architecture` 5/5 PASS.
- Other branches checked: `feature/ntr-legacy-import`, `feature/ntr-module`,
  `feature/pm-record-types` are all fully merged into `origin/main`
  already (no outstanding PR work). `backup/8606773` and `origin/sprint11`
  are unrelated, superseded PM-record exploratory work predating this
  redesign branch - left untouched, out of scope. Two local branches
  (`feature/pm-record-types`, `sprint10-followup`) are fully merged and
  safe to delete, but branch deletion is a hard-restricted destructive
  action - flagged for the repo owner to delete, not done here.
- Two Storage Platform stashes (`storage-platform-v1.0-uncommitted`,
  `-env-example`) remain in the stash list, now fully redundant with
  commit `9915f3d` - not dropped, since stash drop is an irreversible
  action outside this pass's authorization; flagged for the repo owner.

## Phase 5 Final Consolidation — Architecture Completion (this milestone)

Migrated every remaining module onto the Attachment Platform and
retired the legacy Google Drive direct-upload pipeline, closing out the
architecture this platform's build-out was working toward. Target
shape achieved: `NTR / PM / QIR(MQR) / Machine360 → AttachmentService →
AttachmentRepository → StorageProviderFactory → {Supabase, Cloudflare
R2}` - no business module accesses a storage provider directly.

**Priority 1 - Release blockers, resolved:**
- **NTR/PM record delete** - both failed with a 500 "new row violates
  row-level security policy" error. Root-cause investigation was
  extensive and evidence-based: reproduced in a minimal SQL case with no
  application logic (a plain `UPDATE ... SET record_status='Deleted'`
  as the `anon` role); ruled out with direct evidence every mechanism
  checked - triggers (only standard internal FK-integrity ones),
  rules, table inheritance, views, generated columns, column/table
  grants, hidden/duplicate RLS policies, and the RLS policy's own USING/
  WITH CHECK content (a first fix aligning the policy with MQR's
  already-working fully-permissive shape did **not** resolve it,
  proving policy content wasn't the true cause). The true root cause
  remains an unexplained Postgres/Supabase-platform-level anomaly.
  Resolved via a narrow, targeted workaround: two `SECURITY DEFINER`
  RPCs (`soft_delete_ntr_record()`/`soft_delete_pm_record()`, matching
  the existing `commit_ntr_legacy_import_row()` pattern) that perform
  only the intended soft-delete write - all authorization (role,
  ownership, scope, `canDelete()`) still happens in application code
  before either RPC is ever called. The original RLS policies were
  reverted to their non-permissive form (the loosened version fixed
  nothing and added no value). This is explicitly a workaround for a
  confirmed platform anomaly, not a replacement for RLS - easy to
  revert to a plain `.update()` if Supabase ever identifies the root
  cause (see `supabaseNtrRepository.ts`/`supabaseMaintenanceRepository.ts`'s
  `delete()` doc comments).
- **Google OAuth `invalid_grant`** - not refreshed, per explicit
  instruction; Drive treated as legacy infrastructure to be replaced by
  the migration below, not patched.

**Priority 2 - Attachment Platform migration, one module at a time:**
- **NTR**: `ntr-search.tsx`'s photo/video upload (previously raw
  `fetch('/api/upload')`, completely broken by the OAuth blocker above)
  migrated to `uploadAttachment()`/`newPendingEntityId()`, the same
  pipeline PM/MQR already used. New `AttachmentType` values
  (`CustomerTractorPhoto`/`SerialPlatePhoto`/`HourMeterPhoto`/
  `DeliverySheetPhoto`) and five new nullable `*_attachment_id` columns
  on `ntr_records` (additive-only migration, reviewed against seven
  explicit safety criteria before applying - additive, nullable, no new
  FKs, CHECK constraint widened not narrowed, rollback-safe - before the
  user approved it). `POST /api/ntr-records` reassigns + marks
  business-complete, mirroring PM's exact pattern.
- **PM** (unplanned but confirmed release blocker, found mid-migration):
  `maintenance-search.tsx` - the component `pm-records/new` (the *real*
  "Create PM Record" page) actually renders - still called the legacy
  `/api/upload` directly. `maintenance-form.tsx` (migrated to
  AttachmentService in an earlier milestone) is used only by
  `pm-records/[id]/edit` - that earlier migration never reached the
  create flow, so PM registration was silently just as broken as NTR's.
  Migrated to the identical `uploadAttachment()` pattern; no new DB
  migration needed (the `*_photo_attachment_id` columns and the
  `reassignEntity`/`markBusinessComplete` block in `POST /api/pm-records`
  already existed from that earlier milestone - they simply had no real
  caller sending attachment IDs until now).
- **QIR/MQR**: already fully migrated (`report-form.tsx`/`update-form.tsx`
  both already call `uploadAttachment()`) - confirmed, not re-done;
  live-verified healthy.
- **Machine 360**: display path already read exclusively through
  `AttachmentService`/`AttachmentViewer` (ADR-010) - confirmed, not
  re-done. `MachineService.getMachineAttachments()` only aggregated
  MQR + PM (NTR wasn't on the platform yet when that was written, per
  its own doc comment); added `fetchNtrRecordsForSerial()` (mirrors
  `fetchMaintenanceHistoryForSerial()` exactly) and wired NTR into the
  same three-way aggregation.
- Every module verified end-to-end on Preview after its own migration:
  upload (R2-backed, confirmed via live UAT for every module), download,
  attachment reassignment + business-complete, and - critically - the
  Priority 1 delete fix, re-confirmed working on each newly-migrated
  record type.

**Priority 3 - Legacy removal**, after every module's migration was
verified:
- Removed: `uploadFileSmart.ts`, `/api/upload` (+`/init`/`/chunk`/
  `/finalize`), and `googleDrive.ts`'s `initResumableUpload()`/
  `finalizeResumableUpload()`/`relocatePendingFiles()`/
  `driveFileIdFromUrl()` - confirmed via repeated repo-wide search
  (excluding comments, checking for dynamic imports) that zero real
  callers remained anywhere.
- Kept in `googleDrive.ts`: `uploadFileToDrive`/`deleteFileFromDrive`/
  `downloadFileFromDrive`/`fileExistsOnDrive`/`listFilesInDriveFolder`
  and their shared folder-resolution helpers -
  `GoogleDriveStorageProvider` (the Attachment Platform's *archive*
  tier) still depends on all of them. Drive is not retired, only the
  legacy direct-upload path is.
- Cleaned up one stale test mock (`pm-records/route.test.ts` mocked
  `relocatePendingFiles`, which the route hadn't actually called since
  its own earlier AttachmentService migration).

**Priority 4 - Verification**: full suite (lint/typecheck/test/build/
architecture) re-run after every single change in this milestone, not
just at the end - `vitest run` reached 413/413 (up from 407, +6 new
repository-level delete tests for the SECURITY DEFINER RPC path).
Preview redeployed and live E2E UAT re-run after every module's
migration and again after the legacy removal (regression sweep:
upload/download/delete confirmed clean across NTR/PM/MQR).

**Priority 5 - Cloudflare R2**: `STORAGE_PROVIDER=CLOUDFLARE_R2` was
already configured in Preview/Production from the earlier Storage
Platform milestone - every UAT this entire milestone ran against R2 as
the live primary provider, which doubles as continuous verification of
upload/large-upload/preview/signed-URL/delete/metadata. Provider-switch
code-coupling verified by inspection: `StorageProviderFactory` is the
sole construction point (enforced by `architecture-check.ts` Rule 4),
switching `STORAGE_PROVIDER` requires zero business-module changes.
R2 CORS remains the one open, external blocker (Cloudflare Dashboard
access required) - unchanged from `R2_PRODUCTION_READINESS.md`,
confirmed still accurate.

**Commits this milestone**: `3469de0` (RLS→RPC fix), `9b24254` (NTR
migration), `c1262e3` (PM create-flow fix), `0b6e26e` (Machine 360 NTR
aggregation), `c18a82b`+`6ece1dc` (legacy removal).

## MASP Platform Foundation v1.0.0 — Release Baseline (this milestone)

Verified and accepted. Full release record:
**`docs/releases/MASP_PLATFORM_FOUNDATION_V1.0.md`** - read that
document for the release date, architecture overview, module/platform
list, verification table, and known external items; this entry is a
pointer, not a duplicate.

- Attachment Platform, Storage Platform, and Historical Import
  Framework are now formally **Foundation status (feature-frozen)** -
  further work on any of the three is bug fixes and security hardening
  only, until an explicit future decision reopens them.
- Two superseded release-candidate documents
  (`docs/releases/PILOT_v1.0.0.md`, `docs/releases/RC1_RELEASE_NOTES.md`)
  archived to `docs/releases/archive/` (kept, not deleted, per this
  repo's historical-record convention) with a superseded-by banner
  pointing to the new baseline; every cross-reference to their old path
  updated.
- Verification re-run fresh at release time: `eslint` 0 errors (9
  pre-existing warnings), `tsc --noEmit` clean, `vitest run` 413/413,
  `next build` succeeds, `npm run architecture` 5/5 PASS, Preview UAT
  live-verified on the exact release commit.
- Phase 6 has not started - this release closes out the Foundation
  work only, per explicit instruction.

## MASP Platform Foundation v1.1.0 — Release Baseline (this milestone)

Verified and accepted. Full release record:
**`docs/releases/MASP_PLATFORM_FOUNDATION_V1.1.md`** - read that
document for the release date, architecture overview, module/platform
list, verification table, breaking changes, known limitations, and
rollback plan; this entry is a pointer, not a duplicate.

- Rolled out the **Dealer/Branch Scope Platform Standard**
  (`src/lib/dealerBranchScope.ts` +
  `src/components/shared/scope/useDealerBranchScope.ts`/
  `DealerBranchSelector.tsx`) across every module in sequence: Dashboard
  → NTR → PM → QIR/MQR → Machine360 → Reports (audited, no gap) → Export
  (audited, no gap) → Historical Import → shared search dialogs
  (`ntr-search.tsx`/`maintenance-search.tsx`/`report-form.tsx`) →
  remaining APIs (admin master-data routes, `platform/events`,
  `technicians`).
- `DealerUser` visibility changed from "records I personally created"
  (`seesOwnRecordsOnly`, now fully removed) to "every record in my own
  branch" - a service branch is a team, not an individual.
- Found and fixed real, previously-undetected gaps (not just
  refactoring): NTR/PM's Machine360 fetch-for-serial utilities filtering
  on the legacy free-text `session.branch` instead of the real
  `branchId`; a completely unscoped `GET /api/pm-records`; MQR's
  `createRecord()` validating a submitted `branch_id` only against the
  dealer, not the DealerUser's own branch; NTR Historical Import
  validating `dealer_id` but never `branch_id`.
- **DealerBranchScope** joins Attachment Platform, Storage Platform, and
  Historical Import Framework as **Foundation status (feature-frozen)** -
  further work on any of the four is bug fixes and security hardening
  only, until an explicit future decision reopens them.
- `docs/releases/MASP_PLATFORM_FOUNDATION_V1.0.md` archived to
  `docs/releases/archive/` with a superseded-by banner (kept, not
  deleted, not modified - its own `v1.0.0` tag/release remain published
  and untouched); every live cross-reference to its old path updated.
- Verification re-run fresh at release time: `eslint` 0 errors
  (pre-existing warnings only), `tsc --noEmit` clean, `vitest run`
  453/453, `next build` succeeds, `npm run architecture` 5/5 PASS,
  Preview UAT live-verified with real create/edit/delete/upload calls
  across SuperAdmin/DealerAdmin/two DealerUsers in different branches of
  the same dealer on the exact release commit.
- Merged to `main` via PR #11 (merge commit `35153ea`), tagged `v1.1.0`,
  GitHub Release "MASP Platform Foundation v1.1.0" published. Existing
  `v1.0.0` tag/release left untouched per explicit instruction.

## Post-v1.1.0 Development Standard (this milestone)

Formalized the governance for all work after v1.1.0 - full detail in
`CLAUDE.md` §3.6, `docs/architecture/PLATFORM_CONSTITUTION.md`'s new
Authorization rules section, and `docs/ROADMAP.md`'s new "Next
Development Phase" section; this entry is a pointer, not a duplicate.

- Attachment Platform, Storage Platform, DealerBranchScope, and
  Historical Import Framework are the frozen Foundation - reuse
  mandatory, no parallel implementations, further work on any of them is
  bug/security/performance fixes only.
- Next development phase priority order: Workflow Engine → Service
  Management → Customer Experience → Machine Intelligence → Predictive
  Maintenance. None scheduled or scoped yet - each requires its own
  explicit milestone.
- Fixed a stale claim in `PLATFORM_CONSTITUTION.md`'s Future extension
  rules #7 ("no automated architecture-boundary check exists in this
  repository") - `scripts/architecture-check.ts` has existed and been
  CI-wired since the Storage Platform freeze; corrected to say so and to
  note it does not yet cover DealerBranchScope or general module-to-
  module isolation.
- No code changed this milestone - documentation and governance only.

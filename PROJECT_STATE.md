Current Sprint: Sprint 10
Current Branch: feature/pm-record-types
Current Module: PM Record
Current Milestone: M6.2 Complete — Row Level Security Hardening
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

Next Milestone: not yet scheduled
Candidate next tasks (unscheduled, pending explicit direction):
- A future ADR decision on Supabase Auth (or per-request session
  variables) if real RLS-enforced dealer/branch isolation is ever required
- Drop the four unused legacy columns on `pm_records` (cleanup only)
- PDI/media upload, dashboard/KPI integration, PDF export — none started

Current Blockers:
None (the live-schema defects above are flagged, not blocking, since the
table has 0 rows in the live environment today)

Legacy Naming (tracked, not yet renamed — pending ADR):
- SESSION_COOKIE = 'mqr_session' (lib/auth.ts)
- STORAGE_BUCKET = 'mqr-files' (lib/supabase.ts)
- MqrRecord interface (lib/types.ts)
- Sidebar display name 'Market Quality Report' (sidebar.tsx)

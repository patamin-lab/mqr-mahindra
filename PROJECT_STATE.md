Current Sprint: Sprint 10
Current Branch: feature/pm-record-types
Current Module: PM Record
Current Milestone: M5.5 Complete — Database Hardening & RLS Audit
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

Known open defects (live database, not code — require a separately
approved migration, not part of any completed milestone):
- Live `pm_records` table is missing `record_status`, `deleted_by`,
  `deleted_at` columns that every repository method assumes exist
- Live `pm_records.scheduled_date` is NOT NULL; the app treats it as
  optional end-to-end
- RLS on `pm_records` is anon-permissive (`WITH CHECK (true)`), matching
  the identical pattern on every other table in this Supabase project —
  platform-wide debt, not a PM-Record-specific regression

Next Milestone: not yet scheduled
Candidate next tasks (unscheduled, pending explicit direction):
- Propose (not apply) a migration fixing the two live-schema defects above
- PDI/media upload, dashboard/KPI integration, PDF export — none started

Current Blockers:
None (the live-schema defects above are flagged, not blocking, since the
table has 0 rows in the live environment today)

Legacy Naming (tracked, not yet renamed — pending ADR):
- SESSION_COOKIE = 'mqr_session' (lib/auth.ts)
- STORAGE_BUCKET = 'mqr-files' (lib/supabase.ts)
- MqrRecord interface (lib/types.ts)
- Sidebar display name 'Market Quality Report' (sidebar.tsx)

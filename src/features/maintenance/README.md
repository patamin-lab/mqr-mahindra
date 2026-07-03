# Maintenance (Preventive Maintenance / "PM" to users)

Technical domain name is `maintenance`; business/user-facing wording stays
**PM** everywhere (PM Record, PM History, PM Report, PM Interval) — see
root `CLAUDE.md`/`AI_CONTEXT.md`. This module was renamed from
`pm-record` in the Architecture Refactoring pass (see `PROJECT_STATE.md`)
purely for internal code organization — database table (`pm_records`) and
API routes (`/api/pm-records/*`) are unchanged.

Status: **Full CRUD complete**, plus the search-first production workflow
(GPS, business numbering, duplicate protection), the History Center, and
Product-Family-based interval resolution (see `PROJECT_STATE.md` Phases
2–5b). This module is the reference implementation for the layered
`UI → API → Service → Repository → Supabase` pattern.

## Layout

- `types/index.ts` — shared types (`MaintenanceRecord`,
  `MaintenanceRecordCreateInput`, `MaintenanceRecordUpdateInput`,
  `MaintenanceHistoryFilter`/`Result`, `MaintenanceStage`/`MaintenanceProgram`,
  `MaintenanceAttachment`). `status` is intentionally a loose string, not a
  fixed union — no requirements document defines a finalized PM lifecycle
  yet.
- `schemas/index.ts` — Zod runtime schemas (`MaintenanceRecordCreateBodySchema`,
  `MaintenanceRecordUpdateBodySchema`) wired into both API routes.
- `repositories/maintenanceRepository.ts` — `MaintenanceRepository`
  interface (data-access contract).
- `repositories/supabaseMaintenanceRepository.ts` —
  `SupabaseMaintenanceRepository`, the real Supabase implementation:
  `list`/`getById`/`create`/`update`/`delete`, all scoped to
  `record_status = 'Active'`; `delete()` is a soft delete (never a hard
  delete).
- `services/maintenanceService.ts` — `MaintenanceService`, the layer routes
  call; delegates to the injected `MaintenanceRepository` and rejects any
  actor with an empty username before mutating.
- `utils/validation.ts` — `ValidationError` and `parseWithSchema()`.
- `utils/fetchMaintenance.ts` — server-side fetch-by-id helper shared by the
  detail and edit pages (calls the API route, never the repository
  directly, even from a Server Component).
- `components/maintenance-search.tsx` — the search-first create workflow
  (`MaintenanceSearch` + `MaintenanceCreateForm`): search→select→autofill→
  enter info→upload photos→save, GPS capture, duplicate check.
- `components/maintenance-history.tsx` — the History Center
  (`MaintenanceHistory`): filters/search/paginated table/saved filters.
- `components/maintenance-gps-detail.tsx` — read-only GPS map for the
  detail page.
- `components/maintenance-form.tsx` — the older generic create/edit form
  (`MaintenanceForm`), still used by `/pm-records/[id]/edit` only; the
  search-first workflow (`maintenance-search.tsx`) is the primary create
  path.
- `tests/` — Vitest unit tests (mock `MaintenanceRepository` directly for
  the Service; mock `@/lib/supabase` for the Repository).

Corresponding API routes live in `src/app/api/pm-records/` and pages live
in `src/app/(app)/pm-records/` — both paths are intentionally unchanged
(backward compatibility).

## API contract

Every endpoint returns the standardized envelope:
`{ ok: true, data }` on success, `{ ok: false, error: { code, message } }`
on failure (`UNAUTHORIZED` / `VALIDATION_ERROR` / `NOT_FOUND` /
`INTERNAL_ERROR`).

## Soft delete

`delete()` never removes a row. It sets `record_status = 'Deleted'` plus
`deleted_by`/`deleted_at`, scoped by `record_status = 'Active'` so a
double-delete or delete-of-already-deleted correctly reports 404 instead
of silently no-op'ing. `list`/`getById`/`update` all exclude
`record_status = 'Deleted'` rows.

## Product Family / Maintenance Program (Phase 5b)

The interval a Maintenance Record can use is resolved through the
vehicle's **Product Family**, never its Tractor Model directly — see
`src/features/maintenance-due/`, `src/lib/db.ts`'s
`listActivePmIntervals(model?)`, and `PROJECT_STATE.md` Phase 5b for the
full Product Family → Maintenance Program Assignment → Maintenance
Interval resolution chain.

## Vehicle 360 integration

This module's history/records feed the Vehicle Life Cycle timeline and
Vehicle 360 summary via `src/features/vehicle/` (Timeline event source +
`MaintenanceSummaryProvider`) — Vehicle 360 never queries this module's
repository directly, only through that provider abstraction.

## RLS

`pm_records`' anon-role RLS policies enforce the soft-delete invariant at
the database layer as a second, defense-in-depth check alongside the
repository's own filtering (`record_status = 'Active'` required for
select/update; insert requires `record_status = 'Active'`; no DELETE
policy exists at all).

**What RLS still does not do, and cannot do without a code change**:
enforce dealer or branch isolation, or verify actor identity. This app has
no Supabase Auth and sets no per-request Postgres session variable, so all
dealer/branch/actor scoping remains 100% application-layer
(`MaintenanceService` + route handlers), exactly matching every other
table in this project (`applyScope()` in `lib/db.ts`).

## What this module does NOT do

No PDF export, no dashboard/KPI integration yet (see `PROJECT_STATE.md`
Phase 4b/4c/5c for planned work), and no `modules/maintenance/` migration —
this module still lives under `src/features/maintenance/` +
`src/app/api/pm-records/` + `src/app/(app)/pm-records/`, not under the
`modules/` framework described in `docs/MODULE_ARCHITECTURE.md`, which
remains unbuilt for every module as of this writing.

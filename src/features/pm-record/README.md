# PM Record (Preventive Maintenance)

Status: **Full CRUD complete** — repository, service, API, UI, runtime
validation, unit tests, and API integration tests are all implemented and
committed. This module is the reference implementation for the
layered `UI → API → Service → Repository → Supabase` pattern (see root
`CLAUDE.md` and `docs/adr/ADR-006-Module-Architecture.md`).

No PDF export, media upload, or dashboard integration exists yet — those
remain future work (see "What this module does NOT do" below).

## Layout

- `types.ts` — shared TypeScript types (`PmRecord`, `PmRecordCreateInput`,
  `PmRecordUpdateInput`). `status` is intentionally a loose string, not a
  fixed union — no requirements document defines a finalized PM lifecycle
  yet; treat this the way the original "Customer" gap was handled
  (flagged, not guessed at). Note: the inline header comments in this file
  and in `repository.ts`/`service.ts`/`supabaseRepository.ts` still say
  "Sprint 10.1 foundation / stub" — that is stale; the implementations are
  complete. Left as-is here since fixing comments in those files is a code
  change, out of scope for a documentation-only pass (flagged for a future
  small cleanup task).
- `schemas.ts` — Zod runtime schemas (`PmRecordCreateBodySchema`,
  `PmRecordUpdateBodySchema`) wired into both API routes. Field-level rules
  match `types.ts`'s intentionally loose shape (e.g. `status` is any
  non-empty string).
- `validation.ts` — `ValidationError` and `parseWithSchema()`, used by both
  routes to convert a zod failure into a 400 `VALIDATION_ERROR` response.
- `repository.ts` — `PmRecordRepository` interface (data-access contract).
- `supabaseRepository.ts` — `SupabasePmRecordRepository`, the real Supabase
  implementation: `list`/`getById`/`create`/`update`/`delete`, all scoped
  to `record_status = 'Active'`; `delete()` is a soft delete (never a hard
  delete — see "Soft delete" below).
- `service.ts` — `PmRecordService`, the layer routes call; delegates to the
  injected `PmRecordRepository` and rejects any actor with an empty
  username before mutating.
- `pm-record-form.tsx` — shared Client Component form for both create and
  edit, discriminated on a `mode: 'create' | 'edit'` prop. Shows
  loading/saving state, disables all fields while submitting, and reports
  success/error via the non-blocking `swalSuccessToast`/`swalErrorToast`
  helpers in `@/lib/swal.ts`.
- `fetchPmRecord.ts` — server-side fetch-by-id helper shared by the detail
  and edit pages.
- `service.test.ts`, `supabaseRepository.test.ts` — Vitest unit tests
  (mock `PmRecordRepository` directly for the Service; mock
  `@/lib/supabase` for the Repository).

Corresponding API routes live in `src/app/api/pm-records/` (`route.ts`,
`[id]/route.ts`, plus `route.test.ts` integration tests at both levels),
and pages live in `src/app/(app)/pm-records/` (list, `new/`, `[id]/`,
`[id]/edit/`, plus a `[id]/delete-button.tsx` client component).

## API contract

Every endpoint returns the standardized envelope:
`{ ok: true, data }` on success, `{ ok: false, error: { code, message } }`
on failure (`UNAUTHORIZED` / `VALIDATION_ERROR` / `NOT_FOUND` /
`INTERNAL_ERROR`). `PATCH` was removed — only `GET`/`POST` on the
collection route and `GET`/`PUT`/`DELETE` on the `[id]` route exist.

## Soft delete

`delete()` never removes a row. It sets `record_status = 'Deleted'` plus
`deleted_by`/`deleted_at`, scoped by `record_status = 'Active'` so a
double-delete or delete-of-already-deleted correctly reports 404 instead
of silently no-op'ing. `list`/`getById`/`update` all exclude
`record_status = 'Deleted'` rows.

## Database schema

The M5.5 Database Hardening & RLS Audit found that the live Supabase
`pm_records` table didn't fully match what this code assumes
(`record_status`/`deleted_by`/`deleted_at` missing entirely;
`scheduled_date` `NOT NULL` vs. the app's end-to-end optional treatment).
This was fixed in M6.1 via an explicitly-approved migration
(`align_pm_records_soft_delete_and_constraints`, applied to the live
project) that added the three missing columns with the same
default/check-constraint shape as the existing `records` table, made
`scheduled_date` nullable, and added indexes on `dealer_id`/`branch_id`/
`technician_id`/`record_status` (previously only the primary key was
indexed). The table had 0 rows at migration time, so this was purely
additive/constraint-relaxing with no data migration involved.

## RLS

M6.2 hardened `pm_records`' anon-role RLS policies (migration
`harden_pm_records_rls_soft_delete_scoping`) to independently enforce the
soft-delete invariant at the database layer, as a second, defense-in-depth
check alongside the repository's own filtering:

- `pm_records_anon_sel`/`pm_records_anon_upd` now require
  `record_status = 'Active'` — a soft-deleted row is invisible and
  untouchable via any raw anon-key call, not just through the app.
- `pm_records_anon_ins` requires a new row's `record_status` to be
  `'Active'`.
- No DELETE policy exists — hard delete via the anon key is already
  impossible (Postgres RLS default-denies any operation with no matching
  policy).

**What RLS still does not do, and cannot do without a code change**: enforce
dealer or branch isolation, or verify actor identity. This app has no
Supabase Auth and sets no per-request Postgres session variable, so
Postgres has no signal to filter on per dealer/branch/user — every request
reaches the database through one shared `anon` role. All dealer/branch/actor
scoping remains 100% application-layer (`PmRecordService` + route
handlers), exactly matching every other table in this project
(`applyScope()` in `lib/db.ts`). This is a real, structural limitation, not
an oversight — closing it requires a separate, future architecture decision
(Supabase Auth with custom claims, or per-request `set_config()`), not RLS
policy work.

## What this module does NOT do

No PDF export, no media/photo upload, no dashboard/KPI integration, and no
`modules/pm-record/` migration (this module still lives under
`src/features/pm-record/` + `src/app/api/pm-records/` +
`src/app/(app)/pm-records/`, not under the `modules/` framework described
in `docs/MODULE_ARCHITECTURE.md`, which remains unbuilt for every module
as of this writing).

# PM Record (Preventive Maintenance) — Foundation

Status: **Sprint 10.1 complete.** No CRUD, no UI, no PDF, no uploads.
This module exists so later sprints have a layered structure to build into,
instead of adding a sixth flat-file admin pattern to `src/lib/`.

No real requirements document for "PM Record" was available at the time this
was written (no docs/ADR/catalog existed in the repository — confirmed by a
full history scan before any of this was added). The field shape in
`types.ts` is therefore intentionally minimal and generic — the same fields
any service/maintenance record would need regardless of final business
rules — and is explicitly NOT a finalized schema. Treat it the way Sprint 8
treated the "Customer" gap: flagged, not guessed at length.

## Layout

- `types.ts` — shared TypeScript types for a PM Record.
- `schemas.ts` — Zod runtime schemas that validate the shapes in `types.ts`.
  Field-level rules are intentionally loose (e.g. `status` is any non-empty
  string) matching the generic scope of `types.ts`. Wired into routes in
  Sprint 10.2 once CRUD is implemented.
- `validation.ts` — Zod-backed helpers (`parseWithSchema`, `parseJsonBody`,
  `isNonEmptyString`) shared across schemas and route handlers. Foundation
  only: no route currently calls these — they exist so Sprint 10.2 has a
  consistent validation layer to plug into.
- `repository.ts` — `PmRecordRepository` interface (data-access contract only — no implementation).
- `supabaseRepository.ts` — Supabase-backed implementation of the repository. Every method is a stub
  (`throw new Error('not implemented — Sprint 10.2')`) until CRUD is built and a `pm_records` table exists.
- `service.ts` — service layer that depends on a `PmRecordRepository`. Method bodies are stubs for the
  same reason.

## What this sprint does NOT do

No `(app)/pm-records` page UI beyond a placeholder route file. No API route logic beyond a route
skeleton that returns 501. No database migration — no `pm_records` table exists yet; this code does
not assume one until a migration is proposed and approved, per the existing repo's STOP-before-migrating
convention. No existing file under `src/lib/`, `src/app/(app)/admin/`, or any other current screen is
touched by this sprint.

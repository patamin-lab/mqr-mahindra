# Template: service (data-access layer)

Convention for a module's `db.ts`-equivalent — the only place that talks to
Supabase for that module.

## Shape

A module's service layer exposes a `list/get/create/update/softDelete`
block per resource, mirroring today's `db.ts`:

- `list<Resource>(scope, filters)` — applies `applyScope()`, returns rows
  the caller is allowed to see.
- `get<Resource>(scope, id)` — same scoping, single row, 404-equivalent
  (`{ ok: false }`) if out of scope rather than leaking existence.
- `create<Resource>(scope, input)` — validated input in, scoped insert.
- `update<Resource>(scope, id, patch)` — scoped update, never a blind
  `UPDATE ... WHERE id = $1` without the scope filter.
- `softDelete<Resource>(scope, id)` — sets `record_status`/`deleted_by`/
  `deleted_at`, never a real `DELETE`.

## Rules

1. **Only the service layer queries Supabase.** Pages and API routes call
   the service layer; they never construct a Supabase query directly. This
   keeps the two-layer isolation rule (`database-template.md`) enforceable
   in one place per module instead of scattered across routes.
2. **Built on `shared/db`**, not a second Supabase client. Once `shared/`
   is extracted (Sprint 3, proposed), every module's service layer imports
   the shared client + `applyScope()` + soft-delete helpers rather than
   reimplementing them.
3. **A module's service layer may only read/write that module's own
   tables**, plus read shared master data (dealers, branches, technicians)
   via `shared/`. It does not reach into another module's tables — if two
   modules need the same data, that need goes through `shared/` or a
   deliberate exported interface, per `.claude/rules/01-architecture-boundaries.md`.

## What this template does not cover

Validation of the `input`/`patch` shapes before they reach the service
layer — see `validation-template.md`.

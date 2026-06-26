# api/

This module's route handlers.

## Convention

- Resource-noun, plural, lowercase paths: `api/<module-id>/<resource>[/[id]]` — e.g. `api/parts-request/requests/[id]`.
- Every response uses the `{ ok: true, ... }` / `{ ok: false, error }` envelope (`modules/template/api-template.md`).
- Every route independently re-checks session and scope server-side, calling the same `shared` permission functions the page used for its UX gate (`shared/admin/PERMISSION_GUIDE.md`'s two-layer pattern) — a route never assumes the page already enforced access.
- Every route applies `applyScope()` and respects RLS on every query (`docs/MODULE_ARCHITECTURE.md` §4) — both layers, never just one.

## Relationship to other docs

- `modules/template/api-template.md` — the Sprint 2 convention this folder implements.
- `docs/MODULE_ARCHITECTURE.md` §3, §4 — envelope shape and database access rules.
- `docs/PERMISSION_MODEL.md`, `shared/admin/PERMISSION_GUIDE.md` — the role/permission checks every route must call.
- `docs/MODULE_CHECKLIST.md` — Authentication/Authorization items this folder is responsible for satisfying.

## Status

Empty. No module route exists yet.

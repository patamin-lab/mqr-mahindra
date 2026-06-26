# pages/

This module's pages and routes.

## Convention

- Server-Component-first, with a session/scope gate at the top of every page (`if (!predicate(session.role)) redirect(...)`) — this is the UX gate, not the only gate; the matching route in `api/` re-checks independently (`shared/admin/PERMISSION_GUIDE.md`).
- URL prefix matches the module's id: `/<module-id>/...` (`docs/MODULE_ARCHITECTURE.md` §8). The module registers its own nav entry via `module.config.ts`'s `nav` field; the shared shell never contains module-specific conditionals.
- Whether this folder is a literal `pages/` directory or documentation pointing at a Next.js App Router route group under `src/app/` is **explicitly undecided** (`docs/MODULE_ARCHITECTURE.md` §8, `modules/template/page-template.md`) — this is carried forward unchanged, not resolved by Sprint 6. It gets decided with a working example when MQR is re-homed into `modules/mqr/` (`docs/ROADMAP.md` Phase 2).

## Relationship to other docs

- `modules/template/page-template.md` — the Sprint 2 convention this folder implements.
- `docs/MODULE_ARCHITECTURE.md` §8 — routing conventions and the open `pages/` vs. route-group question.
- `docs/DESIGN_SYSTEM.md` — layout, header, sidebar, and page-level visual conventions.
- `docs/PERMISSION_MODEL.md` — which roles see which pages.

## Status

Empty. No module page exists yet, and the folder-vs-route-group question remains open.

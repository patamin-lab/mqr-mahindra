# modules/module-template/

**Status:** documentation and folder skeleton only (Sprint 6). Nothing here is executable — every file in this tree is a `README.md` describing what belongs in that folder, not a working file. No business logic is implemented.

## Relationship to `modules/template/` (Sprint 2)

`modules/template/` already exists and is not modified, moved, or renamed by this sprint. The two folders answer different questions and are meant to be read together:

| Folder | Answers | Format |
|---|---|---|
| `modules/template/` | *What convention does each layer follow?* (naming, request/response envelope, RLS, soft delete, validation pattern) | Seven prose convention docs (`module.config.md`, `page-template.md`, `api-template.md`, `database-template.md`, `service-template.md`, `validation-template.md`, `components-template.md`) |
| `modules/module-template/` (this folder) | *What does the literal directory layout look like?* | A real folder per concern, each with a `README.md` pointing back to the matching convention doc above plus any Sprint 5/6 doc that also applies |

When a future sprint is authorized to scaffold a real module (`modules/<name>/`), it copies this folder's directory structure and reads both `modules/template/`'s conventions and `docs/BUSINESS_MODULE_STANDARD.md` (Sprint 6) before writing any code. Neither folder alone is sufficient.

## Contents

```
modules/module-template/
├── components/   UI components local to this module
├── services/      Data-access and platform-service wiring
├── hooks/         Client-side React hooks local to this module
├── types/         TypeScript types for this module's domain entities
├── validation/    Input validation (client + server re-validation)
├── api/           Route handlers for this module's API
├── pages/         This module's pages/routes
└── assets/        Module-specific static assets (expected to stay empty for most modules)
```

Each subfolder's own `README.md` documents that folder specifically. See `docs/BUSINESS_MODULE_STANDARD.md` for how all eight fit together, `docs/MODULE_LIFECYCLE.md` for the status workflow a module's records move through, `docs/PERMISSION_MODEL.md` for the role/permission model, and `docs/MODULE_CHECKLIST.md` for what a module must include before it can be considered complete.

## Non-goals

This sprint does not scaffold a real module, does not write any `.ts`/`.tsx` file, does not change `modules/template/`, and does not change any production code, routing, import, or database schema. The first real use of this skeleton is the sprint explicitly authorized to build a new module (`docs/ROADMAP.md`, Phase 2/3).

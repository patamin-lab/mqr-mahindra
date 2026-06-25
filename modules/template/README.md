# modules/template/

Status: **documentation only (Sprint 2).** Nothing here is executable. No
module has been scaffolded from this template yet — per `docs/ROADMAP.md`
the first real use is the sprint that builds the first new module.

## Purpose

When a sprint is explicitly authorized to build a new module, that work
starts by reading the seven convention docs in this folder plus
`docs/MODULE_ARCHITECTURE.md`, then creating `modules/<name>/` with real
code that follows what they describe. This folder is the spec;
`modules/<name>/` is the implementation. There are no `.tsx`/`.ts` files in
this template on purpose — the Sprint 2 safety rules exclude placeholder
business logic.

## Contents

| File | Defines the convention for |
|---|---|
| `module.config.md` | A module's identity: id, owner, status, permissions, dependencies |
| `page-template.md` | Pages — Server-Component-first, session/scope gating, layout |
| `api-template.md` | API routes — request/response envelope, re-validation rule |
| `database-template.md` | Supabase tables — RLS + `applyScope()`, soft delete, naming |
| `service-template.md` | The module's `db.ts`-equivalent data-access layer |
| `validation-template.md` | Input validation — today's hand-written client/server pattern |
| `components-template.md` | Module-local components vs. `shared/components/` |

## Relationship to other docs

- `docs/MODULE_GUIDE.md` (Sprint 1) — the module contract and per-module
  plug-in notes: what each named module is, at a high level.
- `docs/MODULE_ARCHITECTURE.md` (Sprint 2) — the concrete conventions
  (naming, API, database, permissions, routing, testing) that every file in
  this folder elaborates on for its own layer.
- `templates/` (repo root) — generic copy-and-fill code scaffolds
  (`admin-crud-page/`, `api-route-resource.ts`, etc.), not module-specific.
  A module's actual files will typically start from one of those, applied
  inside `modules/<name>/`.

## Rule

This folder describes conventions; it does not enforce them with tooling
(no generator script, no lint rule) as of Sprint 2. Treat it as binding
anyway, the same way `.claude/rules/01-architecture-boundaries.md` is
binding without being machine-enforced.

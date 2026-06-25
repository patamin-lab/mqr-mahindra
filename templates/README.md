# templates/

Status: **empty — scaffolding only (Sprint 1).** Populated starting Sprint 2.

## Purpose

Copy-and-fill starting points for new code, so a new module or resource
starts from a working, convention-correct example instead of a blank file.
These are plain files, not a code generator — copy, rename, fill in the
blanks, delete what you don't need.

## Planned templates (see `STARTER_ANALYSIS.md` §15 for the full rationale)

| Template | Mirrors |
|---|---|
| `admin-crud-page/` | The Dealers admin module (page + table + create/edit form + API routes) — today duplicated 5x (Dealers, Branches, Technicians, Users, Problem Codes) with no shared abstraction |
| `db-module-section.ts` | A `list/get/create/update/softDelete` block following `db.ts`'s scope + soft-delete + re-validation conventions |
| `api-route-resource.ts` | A REST resource route handler using the `{ok,...}` / `{ok:false,error}` envelope |
| `pdf-export-section.tsx` | A `@react-pdf/renderer` section following the on-disk-font + per-image-data-URI conventions in `exportPdf.tsx` |
| `notification-email.ts` | A new `NotifyKind` following the non-blocking, never-throws pattern in `email.ts` |
| `upload-pipeline-route.ts` | The size-routed upload pattern (≤4MB direct proxy vs >4MB Drive-resumable-relay) |
| `login-gated-page.tsx` | A Server Component page with the session/scope check + redirect pattern used by every page under `(app)/` |
| `tailwind-brand-tokens.md` | The brand color/shadow/gradient tokens from `tailwind.config.ts`, documented for reuse in a new project |

## Rule

A template is a **starting point**, not a dependency — nothing in `src/`,
`modules/`, or `shared/` imports from `templates/`. If you find yourself
importing a template at runtime, it should have been a `shared/` utility
instead.

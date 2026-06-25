# modules/

Status: **empty — scaffolding only (Sprint 1).** No code has been moved here yet.

## Purpose

This is the planned home for self-contained **business modules** in the target
modular architecture (see `docs/ARCHITECTURE.md` and `docs/MODULE_GUIDE.md`).
Each module owns its own pages, API routes, and module-specific types, and
depends only on `shared/` — never on another module's internals.

## Planned modules

| Module | Status | Notes |
|---|---|---|
| `mqr/` | Existing app, not yet moved | Today this is the entire app under `src/app` + `src/lib`. Becomes the reference module once relocated (see ROADMAP, Sprint 3). |
| `pdi/` | Not started | Pre-Delivery Inspection. High overlap with MQR's vehicle lookup, photo upload, admin CRUD — good first new module. |
| `warranty/` | Not started | Claims workflow. `calcWarranty()` (today `src/lib/warranty.ts`) is a shared utility, not module-owned. |
| `parts/` | Not started | Inventory/catalog. A `parts` table already exists in Supabase but is not yet wired into any application code — today `damaged_parts` on an MQR record is free text. |
| `ntr/` | Not started | Scope not yet defined — see open question in `docs/ROADMAP.md`. |
| `dashboard/` | Not started (today bundled inside MQR) | Recommendation: keep as a per-module dashboard pattern (shared chart/KPI components) until 3+ modules exist, then revisit a cross-module analytics module. |

## Rule

Nothing is moved into this folder without an explicit sprint task that says so.
Do not place new business logic here speculatively — extend the existing
`src/` tree until the relevant migration sprint happens.

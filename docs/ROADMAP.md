# Roadmap

The roadmap is organized into five phases. Each phase groups one or more sprints; completed sprint history is preserved underneath the phase it belongs to, and not-yet-started proposals are kept (relocated, not deleted) under the phase where they now fit.

## Phase 1 — Foundation (in progress)

Establishing the repository structure, conventions, and architecture documentation that every later phase builds on. No business modules are built in this phase; it is documentation, scaffolding, and architecture only.

### Sprint 0 (historical)
MQR built as a single monolithic Next.js app. This is the original production state — see `docs/ARCHITECTURE.md` §2–3.

### Sprint 1 — Repository Foundation (complete)
Added `modules/`, `shared/`, `docs/`, `.claude/`, `templates/` and populated them with documentation and AI-agent knowledge base content only. No code moved. No behavior change. No existing file modified.

### Sprint 2 — Module Framework (complete)
Added `modules/template/` (convention docs for `module.config`, `page`, `api`, `database`, `service`, `validation`, `components`, plus a `README`) and `docs/MODULE_ARCHITECTURE.md`, defining folder structure, naming, API and database conventions, shared component/service usage, permissions, routing conventions, and a manual testing checklist for any future module. No production code touched.

### Sprint 3 — Shared UI Inventory (complete)
Audited the existing UI for reusable patterns and produced `docs/SHARED_UI_ANALYSIS.md`, `docs/COMPONENT_CATALOG.md`, and `shared/ui/README.md`, establishing the starting catalog for the shared component library. Documentation only.

### Sprint 4 — Admin Framework (complete)
Analyzed the five existing admin modules (Dealers, Branches, Users, Technicians, Problem Codes) and produced `docs/ADMIN_FRAMEWORK.md` plus the `shared/admin/` guide set (`README.md`, `CRUD_GUIDE.md`, `API_GUIDE.md`, `TABLE_GUIDE.md`, `FORM_GUIDE.md`, `PERMISSION_GUIDE.md`), defining the standard admin CRUD pattern. Documentation only.

### Sprint 5 — Platform Architecture (complete)
Defined the platform-level architecture for the MSEAL SERVICE SYSTEM: product vision, philosophy, architecture principles, design system, naming standards, platform services catalog, data synchronization strategy, media storage architecture, scheduler design, observability strategy, technical stack, and the architecture decision records in `docs/adr/`. Documentation and architecture only — see every document added in this sprint under `docs/` and `shared/services/README.md`.

## Phase 2 — Platform Core (proposed)

Turning Sprint 5's documented architecture into real, working shared infrastructure: the platform services (`shared/services/*`), and the structural moves needed so modules can actually consume them.

- **Extract `shared/`** — move `src/lib/*` into `shared/*` as a mechanical, behavior-preserving move: update import paths, change nothing else. Extract `KpiCard`/`Panel` (today inline in `dashboard/page.tsx`) and a generic `AdminCrudTable` into `shared/ui/`. Requires a full manual regression pass on every page that imports from `src/lib` (there is no automated test suite to catch a missed import — see the manual checklist in `docs/MODULE_ARCHITECTURE.md` §9).
- **Implement the platform services** documented in `docs/PLATFORM_SERVICES.md` — starting with the services that already have a working equivalent to migrate (`auth`, `google-drive`, `pdf`, `notification`), then the services that don't yet exist at all (`synchronization`, `scheduler`, `audit`, `logging`, `monitoring`, `cache`, `search`, `upload`).
- **Re-home MQR** — move `src/app/(app)/*` and the now-shared-free remainder into `modules/mqr/`. This is the first real proof of the module contract (`docs/MODULE_GUIDE.md` §3), using the one module that already works in production as the test case. Also resolves the `pages/` vs. route-group question left open in `docs/MODULE_ARCHITECTURE.md` §8.
- **Begin MQR's migration to `docs/DESIGN_SYSTEM.md`** — presentation-layer only, no business logic changes, per this sprint's explicit design-system commitments.

## Phase 3 — Business Modules (proposed)

Building new business modules on top of the Phase 2 platform core, starting with the module the design system was built for.

- **PM Record** — the first business module implemented directly on `docs/DESIGN_SYSTEM.md`, with no legacy UI to migrate away from.
- **PDI (Pre-Delivery Inspection)** — `modules/pdi/`, reusing `shared/` for vehicle lookup, uploads, and the admin-CRUD template. Validates the module template (`modules/template/`) from a clean slate, with MQR as a working reference next to it.
- **Warranty**, **Parts Request** (formalizing the existing-but-unused `parts` table), **New Tractor Delivery**, **NTR** (scope pending — see Open Questions), **Campaign**, **Dealer KPI**, **Service Bulletin** — pending sequencing decisions and the module-list reconciliation noted in Open Questions below.
- **Dashboard** — pending a decision on whether it becomes its own module or stays per-module composition; see `docs/MODULE_GUIDE.md` §4 and Open Questions below.

## Phase 4 — Enterprise (future)

Capabilities that matter once multiple modules and a larger user base are live: deeper reporting/KPI rollups across modules (`Dealer KPI` feeding cross-module dashboards), stronger operational governance (audit retention policy, backup/restore drills using the `scheduler`/`monitoring` services), and any access-control needs beyond the current role/scope model. Specific scope is intentionally not fixed yet — it should be defined closer to Phase 3's completion, against real usage rather than speculation.

## Phase 5 — AI & Analytics (future)

Forward-looking capabilities that depend on the platform having real, accumulated operational data via Phases 2–4: analytics on top of the Google Sheets reporting mirror (`docs/DATA_SYNCHRONIZATION.md`), and any AI-assisted features (e.g. assisted diagnosis from service records, anomaly detection on warranty claims). Not scoped in detail here — intentionally deferred until there is real data and real platform usage to design against, consistent with this platform's "never guess on ambiguous requirements" practice.

## Open questions (track here, don't let them block delivery)

| Question | Owner | Status |
|---|---|---|
| What does the NTR module actually cover? | Business owner | Unanswered — do not design against a guess |
| `docs/MODULE_GUIDE.md` and `modules/README.md` (Sprint 1) list six modules (mqr, pdi, warranty, parts, ntr, dashboard); Sprint 2's brief named nine (adds PM Record, Campaign, Dealer KPI, Service Bulletin; renames Parts → Parts Request); `docs/VISION.md` (Sprint 5) names eleven (adds New Tractor Delivery). The lists haven't been fully reconciled into one canonical module list. | Architecture | Flagged in Sprint 2, restated in Sprint 5, not yet resolved |
| Does Dashboard become its own module or stay per-module? | Architecture | Deferred to Phase 3, recommendation in `MODULE_GUIDE.md` §4 |
| Introduce a schema-validation library (zod) to stop the client/server validation duplication? | Architecture | Flagged gap, no decision yet — see `modules/template/validation-template.md` |
| Introduce an automated test framework? | Architecture | Flagged gap, no decision yet — currently zero test coverage; `docs/MODULE_ARCHITECTURE.md` §9 is the interim manual substitute |
| Standardize on Supabase's native Auth client, or formalize the existing custom `jose`-based session layer as the `auth` service? | Architecture | Flagged in Sprint 5 (`docs/adr/ADR-001-Supabase.md`, `docs/TECH_STACK.md`), no decision yet |
| Reconcile the stray `.patch`/log files committed at repo root | Housekeeping | Pre-existing, tracked separately, out of scope |

## Non-goals (restated for traceability)

Sprints 1 through 5 explicitly did **not**: move any existing file, change any business logic, change any working feature, rename or move files, change imports or routing, change authentication, change database schema, or implement any platform service, scheduler, or synchronization job. All of that is real production-code work, deliberately deferred to Phase 2 onward, each with its own explicit task and its own approval.

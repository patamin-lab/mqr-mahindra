# Roadmap

## Post-v2.3.1 Roadmap — current

**Supersedes the "Next Development Phase (Post v1.1.0)" section below as
the active plan** (that section is preserved for its still-relevant
Frozen Foundation list and deferred items, not because it's still the
plan being executed). Baseline this roadmap starts from: Tractor IN is
the master source, `vehicles` is the application master, NTR and PM read
from `vehicles`, the Tractor IN sync is in production with a health
endpoint and run logging (`docs/adr/ADR-012-Tractor-IN-Master-Data.md`,
`docs/releases/RELEASE_CHECKLIST_V2.3.1_SYNC_HARDENING.md`).

Full operational detail for the current system: `docs/OPERATIONS.md`
(Phase 1 of this roadmap).

| Phase | Focus | Status |
|---|---|---|
| 1 | Documentation — `docs/OPERATIONS.md` production operations handbook | Complete |
| 2 | Permission Hardening (v2.3.2) — fix `getVehicleBySerial()`'s dealer-scope bug, Permission Matrix, regression tests across NTR/PM/Vehicle 360/Warranty/ORC | Next — plan proposed, implementation not started |
| 3 | Sync Improvements — retry-failed-rows endpoint, single-vehicle sync endpoint, richer health endpoint (success_rate, last error, version) | Not started |
| 4 | Google Sheet Master Data — sheet owner adds Product Family/Sub Model columns, backfill `vehicles.sub_model`, remove PM's model-derivation fallback only once `product_family_id` is 100% populated | Not started — blocked on external sheet-owner action |
| 5 | Vehicle 360 — full lifecycle timeline (Tractor IN → NTR → PM → Warranty → Complaint → ORC → Parts → Campaign → Owner History), read-only Vehicle Overview page | Not started |
| 6 | Workflow — Draft → Submitted → Approved → Delivered → Warranty Active, with audit trail and role approval | Not started |
| 7 | Reporting — cross-module KPI dashboard (tractor count, delivery, PM, warranty, ORC, complaints, dealer KPI, sync status) | Not started |
| 8 | Engineering Quality — architecture ADRs, coding standards, folder structure, dead code/translation cleanup, API documentation, performance budget, error monitoring, security review | Not started |
| 9 | Technical Debt — close every item tracked in `docs/OPERATIONS.md` §10 | Not started |
| 10 | v3.0 — Digital Tractor Passport (one tractor, one lifetime record, QR-code entry point spanning the same Vehicle → NTR → PM → Warranty → Complaint → ORC → Parts → Campaign → Owner History chain as Phase 5) | Not started |

**Working rules for every phase** (binding, from the project owner):

1. Inspect architecture first.
2. Propose an implementation plan.
3. Identify risks.
4. Open a PR.
5. Run lint, typecheck, tests, production build, and architecture check.
6. Never modify Legacy Import unless explicitly requested.
7. Never duplicate master data.
8. Tractor IN remains the single source of truth.
9. `vehicles` remains the application master.
10. Documentation must be updated whenever architecture changes.
11. Do not merge automatically — always wait for review before merging.
12. When a phase completes, update this roadmap, `docs/OPERATIONS.md`,
    the relevant ADRs, and the release checklist. Provide evidence for
    every completed task.

## Next Development Phase (Post v1.1.0) — historical, partially superseded above

**MASP Platform Foundation v1.1.0 is COMPLETE** (`docs/releases/MASP_PLATFORM_FOUNDATION_V1.1.md`, tag `v1.1.0`). This supersedes the Sprint/Phase 1-5 planning below as the source of truth for *current* status — that section is historical planning from before any business module existed, preserved as-is per this repo's "archive, don't delete" convention, not an accurate picture of what's built today (see `PROJECT_STATE.md` for the real chronological build log).

**Frozen Foundation** (feature-frozen — bug fixes, security, and performance work only, until an explicit future decision reopens one):

- Attachment Platform
- Storage Platform
- DealerBranchScope
- Historical Import Framework

Do not redesign or rewrite any of the four unless there is a confirmed bug, security issue, or measurable performance problem. Every new feature reuses them; never a parallel implementation — see `docs/architecture/PLATFORM_CONSTITUTION.md`'s Storage rules and Authorization rules sections for the binding detail.

**Priority order for new work**, each integrating with the shared platforms above rather than building new infrastructure:

1. Workflow Engine
2. Service Management
3. Customer Experience
4. Machine Intelligence
5. Predictive Maintenance

None of these five are scheduled or scoped in detail yet — each requires its own explicit milestone, plan, and approval before implementation starts, the same discipline every milestone through v1.1.0 followed.

**Deferred, not scheduled**: migrating customer address fields (NTR's
`ntr_records.customer_province`/`customer_district`/
`customer_subdistrict`/`customer_postal_code`, or any future module's
equivalent) from free text to resolved `province_id`/`district_id`/
`subdistrict_id` foreign keys against the Address Platform's canonical
tables (`docs/architecture/ADDRESS_PLATFORM.md`,
`docs/adr/ADR-011-Address-Platform.md`). No consumer needs the join
today - this requires its own future ADR once a real business
requirement exists (e.g. address-based reporting/analytics), not a
speculative schema change.

---

## Historical planning (Sprint 1-5, pre-dates the shipped platform)

The roadmap below was organized into five phases. Each phase groups one or more sprints; completed sprint history is preserved underneath the phase it belongs to, and not-yet-started proposals are kept (relocated, not deleted) under the phase where they now fit.

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

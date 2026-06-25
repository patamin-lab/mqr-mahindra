# Roadmap

## Sprint 0 (historical)
MQR built as a single monolithic Next.js app. This is the current
production state — see `docs/ARCHITECTURE.md` §2–3.

## Sprint 1 — Repository Foundation (complete)
Added `modules/`, `shared/`, `docs/`, `.claude/`, `templates/` and
populated them with documentation and AI-agent knowledge base content
only. **No code moved. No behavior change. No existing file modified.**
The app continued to run exactly as before — that sprint only added new,
unreferenced files and folders.

## Sprint 2 — Module Framework (complete)
Added `modules/template/` (eight convention docs: `module.config`, `page`,
`api`, `database`, `service`, `validation`, `components`, plus a `README`)
and `docs/MODULE_ARCHITECTURE.md`, defining folder structure, naming, API,
and database conventions, shared component/service usage, permissions,
routing conventions, and a manual testing checklist for any future module.
**No production code touched. No files moved, renamed, or imports
changed. No placeholder business logic.** Documentation and templates
only — see `docs/MODULE_ARCHITECTURE.md` and `modules/template/`.

## Sprint 3 (proposed) — Extract `shared/`
Move `src/lib/*` into `shared/*` as a mechanical, behavior-preserving move:
update import paths, change nothing else. Extract `KpiCard`/`Panel` (today
inline in `dashboard/page.tsx`) and a generic `AdminCrudTable` into
`shared/components/ui/`. Requires a full manual regression pass on every
page that imports from `src/lib` (there is no automated test suite to
catch a missed import — see the manual checklist in
`docs/MODULE_ARCHITECTURE.md` §9).

## Sprint 4 (proposed) — Re-home MQR
Move `src/app/(app)/*` and the now-shared-free remainder into
`modules/mqr/`. This is the first real proof of the module contract
(`docs/MODULE_GUIDE.md` §3), using the one module that already works in
production as the test case before any new module is built on top of it.
Also the sprint that resolves the `pages/` vs. route-group question left
open in `docs/MODULE_ARCHITECTURE.md` §8.

## Sprint 5 (proposed) — First new module: PDI
Build Pre-Delivery Inspection as `modules/pdi/`, reusing `shared/` for
vehicle lookup, uploads, and the admin-CRUD template. This validates the
module template (`modules/template/`) and the full architecture
(`docs/MODULE_ARCHITECTURE.md`) from a clean slate, with MQR as a working
reference next to it.

## Sprint 6+ (proposed)
Warranty, Parts Request (formalizing the existing-but-unused `parts`
table), NTR (pending scope), and the additional modules named in Sprint 2
— Campaign, Dealer KPI, Service Bulletin, PM Record — pending the
reconciliation noted in Open questions below. Also pending: a decision on
the Dashboard module question in `docs/MODULE_GUIDE.md` §4.

## Open questions (track here, don't let them block delivery)

| Question | Owner | Status |
|---|---|---|
| What does the NTR module actually cover? | Business owner | Unanswered — do not design against a guess |
| `docs/MODULE_GUIDE.md` and `modules/README.md` (Sprint 1) list six modules (mqr, pdi, warranty, parts, ntr, dashboard); Sprint 2's brief named nine (adds PM Record, Campaign, Dealer KPI, Service Bulletin; renames Parts → Parts Request). The two lists haven't been reconciled. | Architecture | Flagged in Sprint 2, not yet resolved |
| Does Dashboard become its own module or stay per-module? | Architecture | Deferred to Sprint 6+, recommendation in `MODULE_GUIDE.md` §4 |
| Introduce a schema-validation library (zod) to stop the client/server validation duplication? | Architecture | Flagged gap, no decision yet — see `modules/template/validation-template.md` |
| Introduce an automated test framework? | Architecture | Flagged gap, no decision yet — currently zero test coverage; `docs/MODULE_ARCHITECTURE.md` §9 is the interim manual substitute |
| Reconcile the stray `.patch`/log files committed at repo root | Housekeeping | Pre-existing, tracked separately, out of scope |

## Non-goals (restated for traceability)

Sprint 1 and Sprint 2 explicitly did **not**: move any existing file,
change any business logic, change any working feature, rename or move
files, change imports or routing, or require a new deployment behavior.
Anything that looks like a refactor belongs in Sprint 3 or later, with its
own explicit task.

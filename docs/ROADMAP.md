# Roadmap

## Sprint 0 (historical)
MQR built as a single monolithic Next.js app. This is the current
production state — see `docs/ARCHITECTURE.md` §2–3.

## Sprint 1 — Repository Foundation (this sprint)
Add `modules/`, `shared/`, `docs/`, `.claude/`, `templates/` and populate
them with documentation and AI-agent knowledge base content only.
**No code moved. No behavior change. No existing file modified.** The app
continues to run exactly as before — this sprint only adds new,
unreferenced files and folders.

## Sprint 2 (proposed) — Extract `shared/`
Move `src/lib/*` into `shared/*` as a mechanical, behavior-preserving move:
update import paths, change nothing else. Extract `KpiCard`/`Panel` (today
inline in `dashboard/page.tsx`) and a generic `AdminCrudTable` into
`shared/components/ui/`. Requires a full manual regression pass on every
page that imports from `src/lib` (there is no automated test suite to
catch a missed import).

## Sprint 3 (proposed) — Re-home MQR
Move `src/app/(app)/*` and the now-shared-free remainder into
`modules/mqr/`. This is the first real proof of the module contract
(`docs/MODULE_GUIDE.md` §3), using the one module that already works in
production as the test case before any new module is built on top of it.

## Sprint 4 (proposed) — First new module: PDI
Build Pre-Delivery Inspection as `modules/pdi/`, reusing `shared/` for
vehicle lookup, uploads, and the admin-CRUD template. This validates the
contract from a clean slate, with MQR as a working reference next to it.

## Sprint 5+ (proposed)
Warranty, Parts (formalizing the existing-but-unused `parts` table), NTR
(pending scope), and a decision on the Dashboard module question in
`docs/MODULE_GUIDE.md` §4.

## Open questions (track here, don't let them block Sprint 1)

| Question | Owner | Status |
|---|---|---|
| What does the NTR module actually cover? | Business owner | Unanswered — do not design against a guess |
| Does Dashboard become its own module or stay per-module? | Architecture | Deferred to Sprint 5+, recommendation in `MODULE_GUIDE.md` §4 |
| Introduce a schema-validation library (zod) to stop the client/server validation duplication? | Architecture | Flagged gap, no decision yet |
| Introduce an automated test framework? | Architecture | Flagged gap, no decision yet — currently zero test coverage |
| Reconcile the stray `.patch`/log files committed at repo root | Housekeeping | Pre-existing, tracked separately, out of scope for this roadmap |

## Non-goals (restated for traceability)

Sprint 1 explicitly does **not**: move any existing file, change any
business logic, change any working feature, or require a new deployment.
Anything that looks like a refactor belongs in Sprint 2 or later, with its
own explicit task.

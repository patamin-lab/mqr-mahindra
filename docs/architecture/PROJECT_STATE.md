# Project State

Live, point-in-time snapshot of where the repository actually is. Unlike
the Constitution (permanent principle) and the ADR Index (permanent
record of decisions), this document is expected to go stale and must be
re-verified against `git log`/`gh pr list`/`docs/adr/README.md` before
being trusted, not read as historical fact.

**No prior document of this kind existed in the repository** (checked
`docs/architecture/`, `docs/`, `docs/governance/`, `docs/releases/`) -
created fresh, derived entirely from git history, `gh pr list`, and the
existing architecture/governance documents cited below. Nothing in this
document is invented.

## Constitution and precedence

`docs/architecture/PLATFORM_CONSTITUTION.md` (v1.0, effective 2026-07-13)
is this repository's engineering constitution - Vision/Mission/Values/
Engineering/Business/Domain/Capability/Navigation/Knowledge/AI/Data/
Governance Principles, sitting above the Architecture Blueprint,
Architecture Standards, ADRs, and Design Framework per
`docs/governance/DOCUMENTATION_HIERARCHY.md`. Read it first, always.

## Current milestone

**Business Workflow Consolidation (ADR-036).** Audit only, no
code/schema/API/UI change - see `docs/architecture/
BUSINESS_WORKFLOW_CONSOLIDATION_AUDIT.md` and the new companion
`docs/architecture/BUSINESS_INVARIANTS.md`. A sharper, field-level pass
over ADR-035's ground (below), against this milestone's own precise
Tractor IN/NTR/PM/MQR field-scope rules. **Headline finding**:
`vehicles.dealer_id` is written exclusively by the Tractor IN sync
today (NTR never writes it), and `vehicles.delivery_date` can be
silently overwritten by a later Tractor IN sync after NTR has already
activated warranty - both violate this milestone's stated rule, and
both trace to ADR-029's deliberate `dealer_id` sync-scope extension - a
real, named conflict between an Accepted architecture decision and a
newly-clarified business rule, flagged for explicit resolution, not
silently patched. Also confirms Repair/MQR Closed need **zero** new
work (already the `Repaired`/`Closed` values `StatusValue` has always
had). Nothing in this document is implemented - its 8-item prioritized
plan (P0-P7) is each its own future PR.

## Recently completed: Business Workflow & UX Audit (ADR-035)

Workflow-level pass over the tractor lifecycle (not yet merged, PR #57)
- full detail `docs/architecture/BUSINESS_WORKFLOW_UX_AUDIT.md`. Found
three dead/unmodeled Delivery-lifecycle stages (MSEAL Stock/Ship to
Dealer/Dealer Stock), a non-existent Troubleshooting workflow, and two
small nav defects (duplicate PIP entry, "Import Inspection" vs.
"Quality Inspection" naming drift) - all still open, restated and
built upon by ADR-036 above, not resolved by either audit.

## Recently completed: v3.1 Customer Ownership (ADR-033/034), Phase 1 + Governance Gate

PRs #50-#54 all merged. `customers`, `customer_ownership_history`, and
`vehicles.customer_id` exist in the live schema (migration
`20260715054732_customer_ownership_schema_v3_1`) but are not yet read
or written by any application code. **Every implementation phase is
currently gated WAIT** per `docs/architecture/
CUSTOMER_COMPLIANCE_DECISION_REGISTER.md`:

| Phase | Gate | Status |
|---|---|---|
| Phase 2 - Backfill | CDR-001 (PDPA review), CDR-002 (retention period), CDR-003 (anonymization design), CDR-006 (request-process owner), CDR-007 (identity-key validation) all Resolved | **WAIT** - 5/5 open |
| Phase 3 - CustomerService + APIs | Phase 2 complete + CDR-004 (cross-dealer visibility) Resolved | **WAIT** - transitively blocked, CDR-004 open |
| Phase 4 - UI + Cutover | Phase 3 complete + a full production reporting cycle with no new issue surfaced | **WAIT** - transitively blocked |

None of the open decisions are open-ended engineering questions - each
is a named Legal, Business, or bounded-Engineering item with a single
owner. Full detail, including each decision's risk and recommendation:
`docs/architecture/CUSTOMER_COMPLIANCE_DECISION_REGISTER.md`,
`docs/adr/ADR-034-Customer-Data-Governance.md`,
`docs/architecture/CUSTOMER_OWNERSHIP_PROPOSAL.md`,
`docs/adr/ADR-033-Customer-Ownership.md`.

**v3.0 Foundation Hardening (ADR-032)** - architecture-hardening audit,
no code or schema change. Full detail:
`docs/architecture/V3_FOUNDATION_HARDENING_AUDIT.md`.

Outcome: **PASS**. All 9 named business domains (Vehicle, Machine
Passport, Import Inspection, NTR, Warranty, PM, MQR, Timeline, Documents)
confirmed to have exactly one code owner, zero circular dependencies,
RBAC/scoping consistent. Named, not fixed: 4 read-only boundary
violations, 5 duplicate implementations, 5 dead/test-only methods, an
API envelope-shape split by module era - full list in the audit doc's
Technical Debt Register (§11), none blocking.

Remaining v3 roadmap (ADR-032 §10):
- **v3.1 - Customer Ownership Foundation** (in progress, Phase 1 above).
- **v3.2 - Service Operations Consolidation**: backfill `vehicle_id` FK
  onto `ntr_records`/`pm_records`/`records` (currently denormalized
  `serial`-string linking, no FK - the one real schema inconsistency the
  audit found).
- **v3.3 - Analytics-Ready Event Model**: single `getWarrantySummary()`
  read-model; extract MQR's 81 `lib/db.ts` functions into their own
  `features/mqr/` service/repository pair.

## Recent history (merged, most recent first)

| PR | Title | ADR |
|---|---|---|
| #49 | Platform Stabilization - post-ADR-028/029/030 cleanup | ADR-031 |
| #48 | Vehicle 360 consolidation - expand Machine Passport | ADR-030 |
| #47 | Quality Inspection nav consolidation + Vehicle Master Data expansion | ADR-029 |
| #46 | Import Inspection domain correction | ADR-028 |
| #45 | Machine Delivery Platform v1.0 - Tractor In through Warranty Activation | ADR-017, ADR-027 |
| #44 | MSEAL DMS Platform Constitution v1.0 | - |
| #43 | Capability-status-driven navigation visibility | - |
| #42 | Engineering Knowledge Platform v1.0 | ADR-018 |
| #41 | Terminology & navigation cleanup | - |
| #40 | Foundation Freeze v1.0 declared | - |
| #39 | Machine Digital Passport v1.0 | ADR-026 |
| #38 | MSEAL DMS Platform Governance Framework v1.0 | - |
| #37 | MSEAL Design Framework v1.0 | ADR-023 |
| #36 | Import Platform v2 | ADR-022, ADR-024 |

Foundation Freeze v1.0 (`docs/releases/FOUNDATION_FREEZE_v1.0.md`),
amended to v1.1 (`docs/releases/FOUNDATION_FREEZE_v1.1.md`) after the
Delivery Platform (ADR-017/027). Foundation-frozen layers: Architecture
Blueprint, Platform Governance, Design Framework, Navigation Standard,
Dashboard Standard, Authentication Platform, Import Platform Foundation,
Machine Domain, plus `PLATFORM_ARCHITECTURE_STANDARDS.md`'s ten frozen
platform layers - changed only via the Foundation Freeze reopening
process, never a routine PR.

## ADR index

`docs/adr/README.md` is canonical. ADR-001 through ADR-032 exist;
**next available number: ADR-033**. ADR-015/016/019-021 remain reserved
(Machine Domain v2, Event Model, Engineering Intelligence, Analytics
Domain - Inspection/017 and Knowledge/018 already consumed their
reservations).

## Domain ownership (current, per ADR-032 audit)

| Domain | Owner | Notes |
|---|---|---|
| Vehicle (master) | `vehicles` table, `src/shared/master-data/` | Single source of truth (ADR-012, ADR-029) |
| Machine Passport (Vehicle 360) | `src/features/machine/` | Only Vehicle 360 destination (ADR-030); `/vehicles/[serial]` is now a redirect |
| Import Inspection (PDI) | `src/features/inspection/` | ADR-017, corrected by ADR-028 |
| NTR | `src/features/ntr/` | - |
| Warranty | `lib/warranty.ts`'s `calcWarranty()` (pure function, no dedicated table/service) | 7 call sites; named debt (Roadmap v3.3) |
| PM | `src/features/maintenance*/` | - |
| MQR | `src/lib/db.ts` (81 functions) | Only domain without its own service/repository pair; named debt (Roadmap v3.3) |
| Timeline | Machine Lifecycle (`vehicle_events` + per-module `VehicleEventSource`) and Activity Timeline (`shared/activity-timeline/`, `record_audit_log`) - two legitimately separate, non-duplicative implementations | - |
| Documents | `src/shared/attachments/` (Attachment Platform, ADR-010) | - |

Full detail, including the 4 confirmed read-only boundary violations:
`docs/architecture/V3_FOUNDATION_HARDENING_AUDIT.md` §1-§5.

## Technical debt (live register)

Tracked in `docs/architecture/V3_FOUNDATION_HARDENING_AUDIT.md` §11 (15
items as of ADR-032) - not duplicated here. Headline items: MQR's absent
service/repository layer; NTR/PM/MQR's denormalized `serial`-string
vehicle linking (no FK); `calcWarranty()`'s 7 independent call sites with
no shared read-model (one, `report-form.tsx`, ships it into the client
bundle); a handful of dead/test-only methods (`InspectionService.
listActiveInspections`, `MachineRepository`, `AttachmentService`'s
unreachable archive-queue chain via a callerless `StorageScheduler`).

## Validation status

`architecture-check`: 6/6 PASS (last run this session, on ADR-032's
docs-only diff). `tsc`/`eslint`/`vitest`/`next build` last verified
clean on this branch prior to the docs-only edits (no source file has
changed since).

## Known documentation gaps (not fixed this pass)

- `docs/ROADMAP.md` is a stale Sprint-1-through-5-era phase plan
  (predates ADR-017 onward entirely; states "currently zero test
  coverage," no longer true - `vitest` suite exists). ADR-032's own
  Roadmap section (§10, restated above under "Current milestone") is the
  current, accurate near-term plan; `docs/ROADMAP.md` needs a full
  rewrite or retirement, named as debt, not resolved here (out of this
  bootstrap's scope).
- `docs/governance/*.md` (Domain Ownership Matrix, Capability Dependency
  Map) operate at bounded-context grain and were amendment-noted, not
  rewritten, during ADR-032 - see those files' own amendment pointers.

## Verification

Derived from: `git log --oneline origin/main` (commit/PR chain), `gh pr
list --state open` / `--state merged` (PR numbers/titles/status),
`docs/adr/README.md` (ADR numbers/next-available), `docs/architecture/
V3_FOUNDATION_HARDENING_AUDIT.md` (domain ownership, debt register,
roadmap), `docs/architecture/PLATFORM_CONSTITUTION.md` (constitution
status), `docs/releases/` directory listing (Foundation Freeze state).
No fact in this document is asserted without a corresponding
repository artifact.

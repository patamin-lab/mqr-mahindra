# Roadmap

## Release: Foundation v1.0

**Foundation Freeze v1.0 declared 2026-07-12, extended to v1.1 on
2026-07-13** — Architecture Blueprint v1.1, Platform Governance v1.1,
Design Framework v1.1, Navigation Standard, Dashboard Standard,
Authentication Platform, Import Platform Foundation, Machine Domain
v1.0, and (added in v1.1) Platform Constitution, Platform Architecture
Standards, Navigation Visibility Policy, Capability Status Model, and
Business Terminology Governance are all now frozen. See
`docs/releases/FOUNDATION_FREEZE_v1.1.md` (current - what's frozen, how
to reopen it), `docs/releases/FOUNDATION_FREEZE_v1.0.md` (original
declaration, preserved as history), and
`docs/releases/RELEASE_NOTES_FOUNDATION_v1.0.md` (full release notes,
including both Post-Freeze Addenda). Prior baseline: tag `v2.4.0-foundation`,
`docs/releases/RELEASE_NOTES_V2.4.0_FOUNDATION.md`. The sections below
reflect the current baseline — completed work is out of "next" planning,
not because it's finished forever (see the Working rules below), but
because it shipped and moved to maintenance.

## Completed Milestones

- ✓ **Import Platform Foundation** (PR #36) — Import Platform v2's four
  module-agnostic shared services (Thailand Address Resolver, Master Data
  Resolver, Transformation Library, Duplicate Detector) added to the
  Universal Import Framework; NTR Legacy Import migrated onto all four.
  `docs/adr/ADR-022-Import-Platform-v2.md`,
  `docs/architecture/IMPORT_PLATFORM.md`.
- ✓ **Platform Design Framework** (PR #37) — Navigation Standard,
  Dashboard Standard, Platform Overview, and the Screen Contract
  convention every new screen now documents against.
  `docs/adr/ADR-023-MSEAL-Design-Framework.md`,
  `docs/architecture/MSEAL_DESIGN_FRAMEWORK.md`.
- ✓ **Platform Governance** (PR #38) — `docs/governance/` established as
  the canonical home for Documentation Policy, Ownership Matrices,
  Capability Map, Module Maturity Matrix, and Security/API/AI Governance;
  ADR numbering normalized (duplicate `ADR-009` resolved).
  `docs/governance/README.md`, `docs/adr/README.md`.
- ✓ **Machine Digital Passport** (PR #39) — `/machines`,
  `/machines/[machineId]`: Identity, Ownership, Lifecycle, Warranty, PM,
  Quality, Documents, Activity, and Related Records in one place, with
  documented (not fabricated) placeholders for Machine Health, Knowledge
  Score, Next Recommended Action, and Reserved AI panels.
  `docs/adr/ADR-026-Machine-Digital-Passport.md`,
  `docs/architecture/MACHINE_PASSPORT_ARCHITECTURE.md`.
- ✓ **Knowledge Platform v1.0** (PR #42) — Knowledge established as an
  independent business domain: `knowledge_cases`/`knowledge_evidence`,
  `/quality/knowledge` list/create/detail, Evidence-based Machine
  Passport integration (Published cases only, read-only), and reserved
  (Coming Soon) Future AI panels each captioned with the citation
  requirement. The final Foundation capability before AI - no AI
  implemented in this PR. `docs/adr/ADR-018-Knowledge-Model.md`,
  `docs/architecture/KNOWLEDGE_PLATFORM.md`,
  `docs/releases/KNOWLEDGE_FOUNDATION_FREEZE_v1.0.md`.
- ✓ **Machine Delivery Platform v1.0** (PR #45) — the complete digital
  delivery lifecycle: Tractor In (reuses ADR-012), Stock Yard, PDI
  (ADR-017, new `inspections` table), Dealer Preparation, Customer
  Delivery (links NTR), Operator Training, Delivery Acceptance, and
  Warranty Activation as a real point-in-time event for the first time
  (closing a named gap in `03-MACHINE-LIFECYCLE-AND-TIMELINE.md`). New
  `delivery_records`/`delivery_trainings` tables, Machine Passport
  integration, Knowledge integration (Findings promote to Candidates),
  Delivery Dashboard (official 10-KPI contract) and Reports, reserved
  (Coming Soon) AI panels. Platform-quality refinement pass added the
  Service Construction Standard and Architecture Check Rule 6 (no eager
  Repository/Service construction). `docs/adr/ADR-017-Inspection-
  Domain.md`, `docs/adr/ADR-027-Machine-Delivery-Platform.md`,
  `docs/architecture/INSPECTION_PDI.md`,
  `docs/architecture/DELIVERY_PLATFORM.md`.
- ✓ **Import Inspection Domain Correction** (ADR-028) — business-domain
  correction: Import Inspection (MSEAL PDI) is an internal MSEAL quality
  process, never dealer-visible in detail, never linked to NTR - Dealer
  Approval removed, replaced by MSEAL-only Release to Dealer; RE-PDI
  chaining and a Factory Feedback Model added; Warranty Activation is now
  triggered exclusively by NTR (never manually, never by Delivery
  Acceptance). New MSEAL-only Import Inspection Dashboard
  (`/delivery/pdi/dashboard`).
  `docs/adr/ADR-028-Import-Inspection-Domain-Correction.md`.

- **Master Data Governance** — Province/District/Subdistrict formalized as
  System Master Data: business modules are read-only (`MasterDataService`),
  no `INSERT`/`UPDATE`/`DELETE` RLS policy exists on any of the six
  address tables. `docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md` ("Foundation
  Freeze" / "Master Data Governance").
- **Tractor IN Sync** — production sync from the Tractor IN Google Sheet
  into `vehicles`, with a health endpoint and per-run logging; v2.3.1 Sync
  Hardening executed and verified against production.
  `docs/adr/ADR-012-Tractor-IN-Master-Data.md`,
  `docs/releases/RELEASE_CHECKLIST_V2.3.1_SYNC_HARDENING.md`.
- **AuthorizationScope** — fixed the SuperAdmin dealer-scope bug in
  `getVehicleBySerial()` (v2.3.2). `docs/adr/ADR-013-Authorization-Scope.md`.
- **Permission Matrix** — documented role/scope enforcement across
  modules. `docs/architecture/PERMISSION_MATRIX.md`.
- **Activity Timeline** — reusable, generic Activity Timeline component
  (Vehicle 360 foundation), shipped for Quality Reports; designed so
  PM/NTR/Warranty/ORC/etc. can plug in without a redesign.
  `docs/architecture/ACTIVITY_TIMELINE.md`.
- **Quality Report Edit** — Edit Report on the Quality Report Detail page
  (reuses the create form in edit mode); removed the redundant "New
  Quality Report" sidebar entry.
- **Operations Handbook** — `docs/OPERATIONS.md`, the production
  operations reference for the current system.
- **Production Rollout Documentation** — v2.3.1 Sync Hardening's real
  production execution results recorded end-to-end.
  `docs/releases/RELEASE_CHECKLIST_V2.3.1_SYNC_HARDENING.md`.
- **Platform Branding (MSEAL DMS)** — legacy "MASP"/"Market Quality
  Report" platform branding replaced with "MSEAL DMS" wherever it
  represents the application (login, browser title, app shell, sidebar,
  navbar, footer, metadata, email templates, loading/empty states);
  centralized in `src/lib/branding.ts` (`APP_NAME`, `APP_VERSION`). The
  MQR module name, record IDs, database, API routes, and business
  document titles were deliberately left unchanged.
- **Authentication Platform v3.0** — session management (revocable,
  device-aware `user_sessions`), self-service Password Reset/Change,
  User Invitation, First Login forced change, Account Lock Protection,
  IP-based rate limiting, CSRF header enforcement, and a dedicated
  `auth_audit_log` covering all 13 spec event types.
  `docs/adr/ADR-014-Authentication-Platform-v3.md`,
  `docs/architecture/AUTHENTICATION_PLATFORM.md`.
- **Architecture Blueprint v1.1** — the long-term architecture for MSEAL
  DMS as an Engineering Intelligence Platform: Domain Model, Event Model,
  Knowledge Domain, Engineering Intelligence, Analytics, Machine Digital
  Passport, Business Capability Map, Canonical Event Catalog, Integration
  Boundary, and Architecture Governance. Design-only — no code, database,
  or API changed. `docs/architecture/blueprint/README.md`. **Status:
  APPROVED — see "Architecture Status" below.**

## Architecture Status

**Architecture Blueprint v1.1 is APPROVED. The Architecture Baseline is
FROZEN**, effective at this blueprint's merge
(`docs/architecture/blueprint/20-ARCHITECTURE-GOVERNANCE.md`). Frozen
specifically: Machine as the platform's aggregate root, the bounded
context list, the `PlatformEvent` envelope and Canonical Event Catalog's
event ownership, Engineering Intelligence's AI Governance boundary, and
the Integration Boundary rule (no external system reads internal tables
directly). **Any future change to one of these five requires an ADR, an
Architecture Review, and Architecture Approval** per the Blueprint's
governance doc — not a routine PR. Everything else in the Blueprint
(field-level detail, capability-to-module mappings, specific table
shapes) remains a normal design detail, refined freely during
implementation.

**Foundation Freeze v1.0** (`docs/releases/FOUNDATION_FREEZE_v1.0.md`)
extends this same freeze discipline across every Foundation layer, not
just the Architecture Baseline: Platform Governance v1.1, Design
Framework v1.1, Navigation Standard, Dashboard Standard, Authentication
Platform, Import Platform Foundation, and Machine Domain v1.0 are all now
frozen under the identical ADR + Architecture Review + Architecture
Approval process.

## Known Issues (carried forward, not blocking)

- Production alias `mqr-mahindra.vercel.app` returns `DEPLOYMENT_NOT_FOUND`
  — needs a look at the Vercel dashboard's domain assignment, unrelated to
  any application code.
- Collaboration Layer (Comments, Internal/Customer Notes, @mentions,
  Pinned Events) deferred — tracked in issue #30, its own schema/RBAC/API
  review.
- Activity Timeline's Photo History isn't paired 1:1 by category (the
  audit log doesn't record which category a *removed* photo belonged to).
- No true virtualization in the Activity Timeline — "Load more" pagination
  only, until real data volume justifies it.
- PM's model-derivation fallback remains until the Tractor IN sheet's
  Product Family/Sub Model sync is 100% populated (see Next Milestones).

## Next Milestones

Baseline this section starts from: Tractor IN is the master source,
`vehicles` is the application master, NTR and PM read from `vehicles`.
Full operational detail: `docs/OPERATIONS.md`.

| Phase | Focus | Status |
|---|---|---|
| 1 | Sync Improvements — retry-failed-rows endpoint, single-vehicle sync endpoint, richer health endpoint (success_rate, last error, version) | Not started |
| 2 | Google Sheet Master Data — sheet owner adds Product Family/Sub Model columns, backfill `vehicles.sub_model`, remove PM's model-derivation fallback only once `product_family_id` is 100% populated | Not started — blocked on external sheet-owner action |
| 3 | Vehicle 360 — full lifecycle timeline (Tractor IN → NTR → PM → Warranty → Complaint → ORC → Parts → Campaign → Owner History), read-only Vehicle Overview page | Not started |
| 4 | Workflow — Draft → Submitted → Approved → Delivered → Warranty Active, with audit trail and role approval | Not started |
| 5 | Reporting — cross-module KPI dashboard (tractor count, delivery, PM, warranty, ORC, complaints, dealer KPI, sync status) | Not started |
| 6 | Engineering Quality — architecture ADRs, coding standards, folder structure, dead code/translation cleanup, API documentation, performance budget, error monitoring, security review | Not started |
| 7 | Technical Debt — close every item tracked in `docs/OPERATIONS.md` §10 | Not started |
| 8 | v3.0 — Digital Tractor Passport (one tractor, one lifetime record, QR-code entry point spanning the same Vehicle → NTR → PM → Warranty → Complaint → ORC → Parts → Campaign → Owner History chain as Phase 3) | Not started |
| + | Collaboration Layer — `activity_notes` table, comments, internal/customer notes, @mentions, pinned events, notification hooks (issue #30) | Not started |

**Forward reference**: Phase 3 (Vehicle 360) and Phase 8 (v3.0 Digital
Tractor Passport) above are the near-term start of a longer-term
architecture — see `docs/architecture/blueprint/README.md` (APPROVED,
Architecture Baseline FROZEN — see "Architecture Status" above) for the
full long-term design, including how these phases map onto the
Blueprint's own Machine Digital Passport (10)/Machine Timeline (03)/
Knowledge Domain (07) sections. Reconciliation detail:
`docs/architecture/blueprint/13-ROADMAP-AND-MIGRATION-STRATEGY.md`.

**Recommended next implementation order** (platform-wide, supersedes the
per-phase table above as the actual build sequence once Phase 1-2 sync
work clears):

1. ✓ Machine Digital Passport — **done, PR #39, Foundation v1.0**
2. ✓ Knowledge Platform v1.0 — **done, PR #42, ADR-018,
   `docs/releases/KNOWLEDGE_FOUNDATION_FREEZE_v1.0.md`** — the final
   Foundation capability before AI; Knowledge is now the permanent
   engineering knowledge foundation every future AI capability consumes.
3. ✓ Machine Delivery Platform v1.0 — **done, PR #45, ADR-017/ADR-027,
   `docs/releases/RELEASE_NOTES_DELIVERY_v1.0.md`** — the complete
   digital delivery lifecycle, Tractor In through Warranty Activation.
4. **Service Platform v1.0 — recommended next epic** (Preventive
   Maintenance, Warranty, Campaign, Parts, Service Visit, Field Service,
   Service History, Technician). Must reuse Machine Passport, Machine
   Delivery, Knowledge Platform, Activity Timeline, Attachment Platform,
   Authorization, and the Dashboard Framework - not rebuild any of them.
   Not started; this is a recommendation, not a plan to implement from.
5. AI Troubleshooting
6. Engineering Intelligence
7. PIP
8. Predictive Quality
9. Dealer Portal
10. Customer Portal
11. IoT

**Resequencing note**: the Knowledge Foundation Freeze originally
recommended AI Troubleshooting immediately after Knowledge Platform v1.0.
This is not a rejection of that recommendation - it is a sequencing call
made at the Machine Delivery Platform v1.0 merge's own explicit
instruction, recorded here rather than silently overriding the prior
one (see `docs/releases/FOUNDATION_FREEZE_v1.1.md`'s Next Epic section).

Every epic from AI Troubleshooting onward is bound by the Knowledge
Foundation Freeze's AI Contract (`docs/releases/
KNOWLEDGE_FOUNDATION_FREEZE_v1.0.md`): consumes Knowledge through
`KnowledgeService` only, never raw MQR/PM/Warranty data directly, never
writes to Knowledge, always cites Evidence. An epic in this list that
would need to violate that contract is not a routine implementation
detail - it is a Foundation-reopening question, the same weight any
other frozen-layer conflict carries.

This is the sequence to build against going forward. It reorders the
Blueprint's own 13-section dependency-ordered list (which sequences
Machine Timeline before Machine Digital Passport, reasoning that Timeline
should exist first so Passport has something to aggregate) — noted here
explicitly, not silently, per 13's own "say so, don't silently reorder"
convention. Machine Digital Passport shipped without a separate Machine
Timeline milestone first (the Passport's own Lifecycle/Activity panels
absorbed that need — see `docs/architecture/MACHINE_PASSPORT_ARCHITECTURE.md`),
so it's dropped from this list rather than carried forward as a stale
separate item. Each remaining item is its own future milestone requiring
its own plan and approval, per the Working rules below. **Knowledge
Engine v1.0 is recommended, not started** — this document only
recommends it, per Foundation Freeze v1.0's own scope.

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

Do not redesign or rewrite any of the four unless there is a confirmed bug, security issue, or measurable performance problem. Every new feature reuses them; never a parallel implementation — see `docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`'s Storage rules and Authorization rules sections for the binding detail.

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

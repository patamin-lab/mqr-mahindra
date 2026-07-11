# MSEAL DMS — Platform Governance Framework v1.0

This is **not a feature**. It is the operating model that sits above every
other governing document this repository already has:

```
Platform Governance Framework   (this directory)
        │  operationalizes and cross-references
        ▼
Architecture Blueprint v1.1     (docs/architecture/blueprint/01-20, APPROVED, FROZEN)
        │
        ▼
ADRs                            (docs/adr/ADR-001 .. latest)
        │
        ▼
MSEAL Design Framework          (docs/adr/ADR-023, docs/architecture/MSEAL_DESIGN_FRAMEWORK.md)
        │
        ▼
Engineering Principles          (docs/PRODUCT_PHILOSOPHY.md, blueprint 01)
```

**Governance status note (Evidence First):** as of this framework, `main`
has ADR-001 through ADR-014 merged and the Architecture Blueprint v1.1
merged/APPROVED/FROZEN (PR #34). **ADR-022 (Import Platform v2) and
ADR-023 (MSEAL Design Framework) are proposed, not yet merged** (open PRs
#36 and #37 respectively, at the time this framework was written). Every
reference to ADR-022/ADR-023 below is written as *"proposed"* for that
reason — a governance document that presents a pending PR as an already
-accepted decision would itself be a documentation-policy violation (see
`DOCUMENTATION_POLICY.md`). Update these references to "Accepted" once
those PRs actually merge; don't leave this note stale.

## Why this framework exists (and what it does not do)

This repository already has strong architecture governance:
`docs/architecture/blueprint/20-ARCHITECTURE-GOVERNANCE.md` defines the
Architecture Baseline, the Architecture Freeze (5 frozen items), the ADR
Process, Architecture Review, and Architecture Approval. **This framework
does not redefine any of that** — it cites 20 as binding and builds the
next layer up: an operating model that also covers domain/data ownership,
capability mapping, cross-cutting decision authority, event/integration/
API governance, documentation policy, AI governance, security boundary,
and change management — several of which either don't exist yet as named
governance artifacts, or exist only partially/in a different shape than
what this task asks for. Every document below states explicitly what it
extends versus what it deliberately does not restate.

**Grounding rule applied**: every document in `docs/governance/` was
written only after reading the existing binding document(s) that already
cover adjacent ground (`docs/architecture/blueprint/02, 16, 17, 18, 19,
20`; `docs/architecture/PLATFORM_CONSTITUTION.md`;
`docs/architecture/MASP_ENTERPRISE_STANDARD.md`; `docs/standards/*`;
`docs/CORE_DOMAIN_MODEL.md`, `ENTITY_MODEL.md`, `ENTITY_RELATIONSHIP.md`,
`MASTER_DATA.md`, `FUTURE_MODULE_DEPENDENCY.md`; `docs/PERMISSION_MODEL.md`,
`docs/architecture/PERMISSION_MATRIX.md`) — see each document's own
"Relationship to existing documents" section for what was found and how
duplication was avoided.

## Documents in this framework

| Document | Covers | Duplicates? |
|---|---|---|
| `REPOSITORY_POLICY.md` | Public/private, secrets, demo/prod/test data, sample files, Claude Skills, architecture docs, release docs, security rules | New — no prior single repository-governance doc existed |
| `DOMAIN_OWNERSHIP_MATRIX.md` | Owner/status for Machine, Service, Quality, Engineering Intelligence, Reports, Administration, Import Platform, Authentication, Master Data, Timeline, Notifications | Extends 02/17 (bounded contexts + capability map); fills 6 domains 17 doesn't name at all |
| `DATA_OWNERSHIP_MATRIX.md` | Owner Domain/SoT/Consumers/Update Rules/Relationships/Lifecycle for Machine, Customer, Dealer, Warranty, PM, Quality Case, Knowledge Case, PIP, Recall | Extends CORE_DOMAIN_MODEL/ENTITY_MODEL/ENTITY_RELATIONSHIP (Machine/Customer/Dealer only); Warranty/Quality Case/Knowledge Case/PIP/Recall are genuinely new here |
| `CAPABILITY_MAP.md` | Per-domain capability trees (Machine/Dealer/Customer/Service/Quality/Engineering/Administration) | A complementary tree-shaped view over 17's existing flat Capability→Module table — 17 remains authoritative on conflict |
| `DECISION_MATRIX.md` | Who has binding decision authority over which concern (Machine Identity, Warranty, Knowledge, Reports, Import, Authentication, etc.) | New axis — `PERMISSION_MODEL.md`/`PERMISSION_MATRIX.md` already cover role×app-permission and role×dealer-scope; this covers decision *authority over the platform itself*, a different question neither answers |
| `EVENT_OWNERSHIP.md` | Canonical events, owners, publishers, consumers, naming, versioning | Documents and reconciles a **real, pre-existing drift** between `docs/standards/EVENT_CATALOG.md` and `docs/architecture/blueprint/18-CANONICAL-EVENT-CATALOG.md` (two catalogs, two naming conventions, no cross-reference) rather than creating a third |
| `INTEGRATION_BOUNDARY.md` | ERP, Dealer Portal, Power BI, Google Sheets, REST API, IoT, Authentication, Email, SMS, future integrations | Extends `docs/architecture/blueprint/19-INTEGRATION-BOUNDARY.md` (frozen) — 19 already covers ERP/Power BI/Dealer Portal/Customer Portal/Technician Mobile; this fills the Sheets/IoT/Auth/Email/SMS gap 19 leaves open, citing 19's frozen rule rather than restating it |
| `API_GOVERNANCE.md` | Naming, versioning, auth, authorization, pagination, filtering, error handling | Thin pointer — `docs/standards/API_STANDARD.md` already fully owns this; adds only the cross-module API deprecation *process* (ties to `CHANGE_MANAGEMENT.md`) |
| `DOCUMENTATION_POLICY.md` | ADR/Architecture/Skills/Design Docs/Release Notes/Roadmap standardization | New — uses the two real drifts found (duplicate ADR-009 number; two disagreeing event catalogs) as the evidence for why this policy is needed |
| `AI_GOVERNANCE.md` | AI scope/boundaries, Evidence First, human approval, knowledge confidence, prompt standards, model independence, auditability | Thin pointer — `docs/architecture/blueprint/08-ENGINEERING-INTELLIGENCE-ARCHITECTURE.md` already defines the AI Governance boundary and Confidence Policy as **frozen** (one of 20's 5 frozen items); adds only what 08 explicitly leaves open (Prompt Standards, Model Independence as a named principle) |
| `SECURITY_BOUNDARY.md` | AuthN, AuthZ, dealer scope, audit, PII, email, import, secrets | Thin pointer — `docs/standards/SECURITY_STANDARD.md` already owns authN/authZ/dealer-scope/audit/secrets at rule level; adds a PII classification taxonomy and a security boundary diagram, neither of which exists anywhere today |
| `CHANGE_MANAGEMENT.md` | Breaking change process, architecture review, ADR required, migration, deprecation, versioning | Thin pointer to 20's Breaking Change Process + `GIT_BRANCH_STANDARD.md`'s quality gates; adds data-migration governance and deprecation timelines, neither owned elsewhere |

## How to use this framework

1. Before proposing a new module, service, integration, or AI capability,
   check `DECISION_MATRIX.md` for who has authority over that concern and
   `DOMAIN_OWNERSHIP_MATRIX.md`/`CAPABILITY_MAP.md` for where it belongs.
2. Before adding a new entity or table, check `DATA_OWNERSHIP_MATRIX.md`
   for its owner domain and update rules.
3. Before emitting a new event, check `EVENT_OWNERSHIP.md` — and note the
   open drift between the two existing event catalogs before picking a
   naming convention.
4. Before adding an external integration, check `INTEGRATION_BOUNDARY.md`.
5. Before touching AI/Engineering Intelligence, check `AI_GOVERNANCE.md`
   and 08 (frozen) first.
6. Any change matching 20's Architecture Freeze list still goes through
   20's ADR Process unchanged — this framework adds coverage, it does not
   lower that bar.

## Gap Analysis, Governance Roadmap, Technical Debt

See the end of each individual document for its own gaps. Cross-cutting
findings that don't belong to one single document:

### Gap Analysis (cross-cutting)

1. **Duplicate ADR number**: `ADR-009-Machine-Domain.md` and
   `ADR-009-Universal-Import-Framework.md` both exist on `main` with the
   same number. Not caused by this framework; flagged here because
   `DOCUMENTATION_POLICY.md` sets the rule this should have caught.
2. **Two disagreeing event catalogs**: `docs/standards/EVENT_CATALOG.md`
   (`event_code`, UPPER_SNAKE_CASE, Timeline-oriented) and
   `docs/architecture/blueprint/18-CANONICAL-EVENT-CATALOG.md`
   (`PlatformEventType`, PascalCase, Machine-Lifecycle-oriented) never
   cross-reference each other and have non-overlapping event sets. See
   `EVENT_OWNERSHIP.md` for the full comparison and a proposed
   reconciliation rule (not an ADR — that decision belongs to whoever owns
   18, per 20's Breaking Change Process, since 18's ownership content is
   frozen).
3. **Six domains have no capability-map entry at all** in
   `docs/architecture/blueprint/17-BUSINESS-CAPABILITY-MAP.md`:
   Administration, Import Platform, Authentication (present only as
   frozen infrastructure, not a bounded context), Master Data, Timeline
   (present only as a shared component in 02), Notifications (explicitly
   flagged as a gap by 17 itself). `DOMAIN_OWNERSHIP_MATRIX.md` and
   `CAPABILITY_MAP.md` fill this, but the authoritative 17 itself has not
   been updated to include them — a real follow-up, not done here (17 is
   part of the frozen Baseline; updating it is a Breaking-Change-Process
   question, not a documentation-only one).
4. **`docs/PERMISSION_MODEL.md`'s six-role target model has never been
   built** — still 4 roles in production as of this framework. Not new
   information, but worth restating here since `DECISION_MATRIX.md`
   builds on the *current* 4-role model, not the target 6-role one.
5. **Repository visibility discrepancy** (carried over from a prior
   session's finding, not re-verified here): root `CLAUDE.md` states the
   repository is private; a prior check of `gh repo view` found it is
   actually **public**. `REPOSITORY_POLICY.md` documents this as an open
   item requiring the repository owner's decision, not something this
   framework resolves unilaterally.

### Governance Roadmap

1. **Now (this PR)**: this framework - 13 governance documents, no code
   change, no existing document edited.
2. **Next**: resolve the ADR-009 duplicate number (rename one file,
   requires checking every cross-reference to it first).
3. **Next**: reconcile the two event catalogs per `EVENT_OWNERSHIP.md`'s
   proposed rule - owned by whoever holds 18's Breaking Change authority.
4. **Later**: extend `17-BUSINESS-CAPABILITY-MAP.md` itself to include
   the six missing domains - a Breaking-Change-Process item, once
   Administration/Import Platform/Authentication/Master Data/Timeline/
   Notifications are ready to be named bounded contexts rather than
   governance-framework-only entries.
5. **Later**: decide and resolve the repository-visibility discrepancy.
6. **Later**: once ADR-022/ADR-023 merge, update every "(proposed)" tag
   in this framework to "(accepted)".

### Technical Debt

- No automated check enforces "no duplicate ADR number" or "no
  undocumented event" today - both are review-time, human-caught rules
  (see `DOCUMENTATION_POLICY.md`'s verification checklist). A future
  `npm run architecture`-style check could catch the ADR-number case
  mechanically; not built here (would be a real code change, out of
  scope for a governance-documentation-only pass).
- This framework's own `DECISION_MATRIX.md` names decision authority by
  *role name* (e.g. "Architecture Owner"), matching 20's own choice not to
  name a specific person/title/team - keep it that way; do not let a
  future edit hard-code an individual's name into a permanent governance
  document.

## Recommendation

**PASS.** This framework adds real governance coverage (Domain/Data
Ownership, Decision Authority, Event/Integration/AI/Security/Change
Management) without duplicating or contradicting any existing binding
document, and surfaces three real, pre-existing drifts (ADR-009 dup,
event catalog drift, repo-visibility discrepancy) rather than papering
over them. It is documentation-only - no code, no schema, no existing
document was edited as part of creating this framework.

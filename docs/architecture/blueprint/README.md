# MSEAL DMS — Architecture Blueprint

**Status: Design only. Nothing in this directory has been implemented.**
No code was written, no table was migrated, no API was changed, and no
existing module was renamed to produce this blueprint — see each
document's own "Out of scope" note for the specific things it
deliberately does not do.

This is the long-term architecture for MSEAL DMS as an **Engineering
Intelligence Platform** — not a rewrite plan. Every document here is
explicit about what already exists in this codebase today versus what is
proposed, because a large part of this vision is already underway
(ADR-009's Machine facade, the Activity Timeline platform, the shared
Attachment/DealerBranchScope/Master Data platforms) and the blueprint's
job is to name where that's heading and complete it deliberately, not to
discard it and start over.

## How this relates to existing binding documents

- `docs/architecture/PLATFORM_CONSTITUTION.md` — the Foundation Freeze
  list (Storage/Authentication/DealerBranchScope/Attachment/Address/
  MasterData/Lookup/Configuration/Reference Data Platforms) is the
  **frozen infrastructure layer** this blueprint's every future module
  builds on top of, never reimplements. Nothing here proposes touching
  it.
- `docs/adr/ADR-009-Machine-Domain.md` / `docs/engineering/MACHINE_DOMAIN.md`
  — **Machine is already the platform business entity**, decided and
  partially built (`src/features/machine/` facade, Machine 360/Registry/
  Timeline/Health UI). This blueprint extends that decision to full
  aggregate-root status (Section 02) rather than introducing it fresh.
- `docs/standards/DOMAIN_LANGUAGE_STANDARD.md` — the binding business
  terminology table; this blueprint does not contradict it, and any new
  term it introduces (Inspection, Knowledge, PIP) should be added there
  when implementation actually begins, not before.
- `docs/ROADMAP.md` — the near-term, already-committed roadmap (Sync
  Improvements, Google Sheet Master Data, Vehicle 360, Workflow,
  Reporting, Engineering Quality, Technical Debt, v3.0 Digital Tractor
  Passport). This blueprint's Phase 1–8 (Section 13) is the **long-term
  successor** to that roadmap's "Vehicle 360"/later phases, not a
  competing plan — reconciliation is called out explicitly in Section 13.

## Reading order

| # | Document | Deliverables covered |
|---|---|---|
| 01 | [North Star & Principles](01-NORTH-STAR-AND-PRINCIPLES.md) | Mission, Vision, Golden Rule, Architecture Principles, Engineering Principles, Success Metrics |
| 02 | [Domain Model & Context Map](02-DOMAIN-MODEL-AND-CONTEXT-MAP.md) | Domain Model, Context Map (DDD), Bounded Contexts, Aggregate Roots, Repository Boundaries |
| 03 | [Machine Lifecycle & Timeline](03-MACHINE-LIFECYCLE-AND-TIMELINE.md) | Machine Lifecycle Diagram, Timeline-as-SSOT design |
| 04 | [Inspection Domain](04-INSPECTION-DOMAIN.md) | Inspection as its own bounded context |
| 05 | [Service & Quality Domains](05-SERVICE-AND-QUALITY-DOMAINS.md) | Registration/Maintenance/Warranty/Parts, Quality (MQR/PIP/ORC) |
| 06 | [Event Model & Flow](06-EVENT-MODEL-AND-FLOW.md) | Event Model, Event Flow Diagram |
| 07 | [Knowledge Domain & Graph](07-KNOWLEDGE-DOMAIN-AND-GRAPH.md) | Knowledge Model, Knowledge Graph, Knowledge Lifecycle, Knowledge Flow Diagram |
| 08 | [Intelligence / AI Architecture](08-INTELLIGENCE-AI-ARCHITECTURE.md) | AI Service Architecture, AI Governance, Evidence-First AI, AI Decision Support Flow |
| 09 | [Analytics Architecture](09-ANALYTICS-ARCHITECTURE.md) | Analytics Architecture |
| 10 | [Machine Profile](10-MACHINE-PROFILE.md) | Future Machine Profile aggregation |
| 11 | [Database & API Evolution Strategy](11-DATABASE-AND-API-EVOLUTION-STRATEGY.md) | Database Evolution Strategy, API Evolution Strategy |
| 12 | [Future Integrations Readiness](12-FUTURE-INTEGRATIONS-READINESS.md) | IoT/Telematics/Portals/ERP/BI readiness, without redesign |
| 13 | [Roadmap & Migration Strategy](13-ROADMAP-AND-MIGRATION-STRATEGY.md) | Migration Roadmap, Recommended Implementation Order, Phase 1–8 roadmap |
| 14 | [Risks & Technical Debt](14-RISKS-AND-TECHNICAL-DEBT.md) | Risks, Technical Debt |

## Golden Rule

> The goal is not to build software that stores service records. The goal
> is to build a platform that continuously improves engineering decisions
> through reusable knowledge.

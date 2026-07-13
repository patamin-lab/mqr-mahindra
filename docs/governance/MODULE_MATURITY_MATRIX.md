# Module Maturity Matrix

## Relationship to existing documents

No prior document rates modules/domains on a single maturity scale -
`docs/architecture/blueprint/17-BUSINESS-CAPABILITY-MAP.md` has an
"Implementation" column per capability (prose, not a scale) and
`docs/ROADMAP.md` has phase status ("Not started"/etc.) for roadmap
items specifically. This document is new: one consistent scale, applied
to every domain named in `DOMAIN_OWNERSHIP_MATRIX.md`, cited from those
two sources rather than re-deriving status from scratch.

## Maturity Scale

| Level | Meaning |
|---|---|
| **Frozen** | Built, stable, governed by the Architecture Freeze or Foundation Freeze - modification requires the 4-condition bar (defect/security/performance/approved ADR) |
| **Production** | Built, in real use, not a Freeze item - normal review process for changes |
| **Partial** | Some real code/data exists, but the domain is not fully realized (e.g. a capability named but no dedicated table, or wired for only one module) |
| **Design-only** | Architecture/governance documentation exists, no schema or running code |
| **Not started** | Not named anywhere as buildable yet, or named only as a future capability with zero design detail |

## Matrix

| Domain / Capability | Maturity | Evidence |
|---|---|---|
| Authentication | Frozen | `PLATFORM_ARCHITECTURE_STANDARDS.md` Foundation Freeze; ADR-014 v3.0 |
| Master Data | Frozen | `PLATFORM_ARCHITECTURE_STANDARDS.md` Foundation Freeze; ADR-011 (Address v2), ADR-012 |
| DealerBranchScope | Frozen | `PLATFORM_ARCHITECTURE_STANDARDS.md` Foundation Freeze |
| Attachment/Storage Platform | Frozen | `PLATFORM_ARCHITECTURE_STANDARDS.md` Foundation Freeze |
| Machine (aggregate root) | Frozen (identity/aggregate concept), Production (Registry/Vehicle 360 today) | 20's Architecture Freeze; `vehicles` table, ADR-009 |
| Service > Registration (NTR) | Production | Built, end-to-end (`features/ntr/`) |
| Service > Maintenance (PM) | Production | Built (`pm_records`) |
| Service > Warranty | Partial | `calcWarranty()` logic only, no table (`DATA_OWNERSHIP_MATRIX.md`) |
| Service > Parts | Not started | 17: "no dedicated module/table yet" |
| Service > Campaigns (Recall/Service Campaign) | Not started | No table, no nav route beyond Coming Soon (ADR-023) |
| Quality (MQR) | Production | Built (`records` table), oldest module in the platform |
| Quality > PIP (as a Quality-adjacent reference) | Not started | No table; capability named only |
| Knowledge | Design-only | 07/02 name the aggregate (`KnowledgeCase`); no `knowledge_cases` table |
| Engineering Intelligence | Design-only | 08 fully specifies AI Governance/Confidence Policy (frozen concept); `EngineeringIntelligenceService`/`ModelGateway` not built |
| PIP (as an Engineering Intelligence deliverable) | Not started | No table; ownership assigned by ADR-023's addendum, nothing built |
| Recall | Not started | Not named in 02/17 at all; first named in this governance framework |
| Reports / Analytics | Partial | Quality Dashboard (`/quality/dashboard`) is real and built; cross-domain Reports nav (ADR-023, proposed) is Coming Soon everywhere else |
| Administration | Production | Users/Master Data screens/Import History/System Health all built |
| Import Platform | Production (v1, NTR), Proposed (v2 extensions) | ADR-024 (Universal Import Framework, this pass's renumbering) built and NTR-adopted; ADR-022 (Import Platform v2, proposed PR #36) extends it, not yet merged |
| Timeline | Production (MQR only) | `shared/activity-timeline/` built and used by MQR's record detail; not yet extended to PM/NTR/other modules despite being a named platform standard |
| Notifications | Not started | `NotificationBell` is a static placeholder with zero backing service (`DOMAIN_OWNERSHIP_MATRIX.md`) |
| MSEAL Design Framework (governance-adjacent, not a domain) | Proposed | ADR-023, open PR #37, pre-merge refinement already applied on that branch |
| Platform Governance Framework (this framework) | Proposed | This PR (#38), not yet merged |

## Gap Analysis

- "Partial" is doing real work for Warranty, Reports/Analytics, and
  Machine (as aggregate root vs. today's simpler facade) - each has a
  materially different meaning for "partial" (a calculation with no
  storage; one real dashboard among several planned; a frozen *concept*
  well ahead of a frozen *implementation*). Don't read "Partial" as one
  uniform 50% - check the Evidence column for what's actually true.
- This matrix will go stale the moment any "Not started"/"Design-only"
  row gets built - it describes a snapshot, not a live status; re-verify
  against `docs/ROADMAP.md` and the actual codebase before relying on it
  for a decision more than a few weeks old.

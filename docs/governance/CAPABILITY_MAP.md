# Capability Map

## Relationship to existing documents

`docs/architecture/blueprint/17-BUSINESS-CAPABILITY-MAP.md` (frozen,
part of the Baseline) is the authoritative Capability → Business Module
→ Implementation index. **This document does not compete with it.** It
presents the same underlying capabilities as a per-domain tree (the
shape the task asked for - `Machine ├── Registration ├── Passport ...`)
rather than 17's flat table, because a tree makes "what does Machine
include" easier to scan than a table keyed the other way. **Where this
tree and 17 disagree, 17 wins** - it is part of the frozen Baseline; this
document is a governance-layer convenience view, not a second Baseline.

## Machine

```
Machine
├── Registration          (Service > NTR - 17 "Registration")
├── Passport               (proposed - ROADMAP.md priority #1, not built; 10-MACHINE-PROFILE.md)
├── Timeline                (shared/activity-timeline/, ACTIVITY_TIMELINE.md)
├── Warranty                 (Service - no table yet, DATA_OWNERSHIP_MATRIX.md)
├── PM                        (Service > Maintenance - 17 "Maintenance", built)
├── Quality                    (Quality - 17 "Quality Management (MQR + PIP)", built as MQR)
├── Knowledge                   (Knowledge domain, 07 - not built; source_events reference Machine)
├── AI                           (Engineering Intelligence, 08 - reads Knowledge about this Machine, never Machine tables directly)
├── PIP                           (Engineering Intelligence, produced from this Machine's Quality/Knowledge - not built)
└── Recall                         (Service > Campaigns - not built, targets a population including this Machine)
```

## Dealer

```
Dealer
├── Branches              (Master Data - built, ENTITY_RELATIONSHIP.md)
├── Technicians             (Master Data - built, organizational only, no branch FK yet - open gap)
├── Machines                 (via Customer AND directly, both are real FKs - ENTITY_RELATIONSHIP.md)
├── Users                      (Administration - RBAC, scoped to this Dealer)
├── Dealer KPI                  (Reports/Analytics - 09, DASHBOARD_MODEL.md)
└── Import History                (Import Platform - sessions scoped to importer's context, not yet dealer-scoped itself - see Import Platform's own known gap, ADR-023 proposed) 
```

## Customer

```
Customer
├── Machines Owned        (Tractor.customer_id - direct FK, ENTITY_RELATIONSHIP.md)
├── Service History         (via Machine - PM/Quality/Warranty records referencing owned Machines)
├── NTR Delivery Record       (Service > NTR - Acceptance Date captured here, DOMAIN_LANGUAGE_STANDARD.md)
└── (no login, no Role)         (ENTITY_MODEL.md - Customer is never a system user)
```

## Service

```
Service
├── Registration (NTR)     (built)
├── Maintenance (PM)         (built)
├── Warranty                  (no table yet - DATA_OWNERSHIP_MATRIX.md)
├── Parts Request               (17 "Parts Management" - "no dedicated module/table yet")
└── Campaigns                     (proposed nav grouping, ADR-023)
    ├── Recall                       (not built)
    ├── Service Campaign               (not built)
    └── PIP (reference only)             (owned by Engineering Intelligence - Service tracks, does not own)
```

## Quality

```
Quality
├── Dashboard              (built - the original MQR analytics dashboard, moved to /quality/dashboard per ADR-023 proposed)
├── Cases                    (built - MQR/`records` table)
├── Analytics                  (not built beyond the Dashboard's own charts)
├── Knowledge (reference only)   (Quality Cases feed Knowledge - Quality does not own Knowledge Cases)
└── PIP (reference only)           (produced from Quality's own Cases/Knowledge, owned by Engineering Intelligence)
```

## Engineering Intelligence

```
Engineering Intelligence
├── Knowledge Engine        (07 Knowledge Domain - not built)
├── Troubleshooting           (proposed nav, ADR-023 addendum - Coming Soon, architecture-reserved only)
├── AI Analysis                 (08 - capabilities named, not implementation-level designed)
├── Prediction                    (08's "Predictive Quality Analytics" capability - feeds Analytics per 09's one exception)
├── PIP                              (owned here per ADR-023's addendum - produced from Knowledge)
└── Insights                           (proposed nav grouping over the above capabilities)
```

## Administration

```
Administration
├── Users                  (built - RBAC via lib/scope.ts, 4 roles)
├── Master Data              (built - Dealers/Branches/Technicians/Problem Codes/PM Intervals/Product Families/Maintenance Programs)
├── Import History             (built, ADR-023 proposed - /admin/import-history)
├── Audit                        (data exists per-record via record_audit_log; no cross-module admin UI yet)
├── Sessions                       (self-service only, /profile/security - no admin cross-user view yet)
└── System Health                    (built - Tractor-IN sync health, /admin/email-health)
```

## Cross-references not repeated here

Import Platform, Authentication, Master Data (as a platform layer rather
than the Administration screens that manage it), Timeline (as a shared
rendering component rather than Machine's own sub-concept), Notifications,
and Reports are documented in `DOMAIN_OWNERSHIP_MATRIX.md` rather than
given their own tree here, since - per that matrix's own conclusion -
they are cross-cutting capabilities or frozen platform layers, not
domains with a capability *tree* the way Machine/Dealer/Customer/Service/
Quality/Engineering Intelligence/Administration are. Giving them a fake
tree here would imply a domain shape they explicitly don't have.

## Gap Analysis

- Passport, Knowledge Engine, Troubleshooting, AI Analysis (implementation
  level), Prediction, Insights, Warranty, Parts Request, Recall, Service
  Campaign, PIP (as a real table), Quality Analytics/Knowledge (real UI)
  are all named here as capability-tree leaves with **no implementation**
  - consistent with 17's own practice of naming a capability before it's
  built; this tree does not authorize building any of them.
- Import History under Dealer is flagged as not-yet-dealer-scoped -
  real, existing gap (Legacy Import/Import History today is SuperAdmin
  -only, not per-dealer at all) worth a future decision in
  `DECISION_MATRIX.md`'s successor once Import Platform grows a
  multi-tenant import story.

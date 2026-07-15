# ADR Index

Canonical, generated-by-hand index of every Architecture Decision Record
in this repository. Produced by the Platform Governance Framework's ADR
normalization pass (`docs/governance/DOCUMENTATION_POLICY.md`) after
finding and fixing a real duplicate ADR number (`ADR-009`, see below).
**Guarantee this index exists to enforce going forward: one ADR, one
number, one topic.** Before assigning a new ADR number, check this file's
"Next available number" line - do not just look at the highest file on
disk, since reserved ranges (below) are not visible from a directory
listing alone.

## Index

| # | Title | Status | Notes |
|---|---|---|---|
| ADR-001 | Supabase as the Platform Database and Source of Truth | Accepted | |
| ADR-002 | Google Drive as the Media Repository | Accepted | |
| ADR-003 | Google Sheets as the Reporting and Daily Snapshot Layer | Accepted | |
| ADR-004 | Centralized Platform Services Under `shared/services/` | Accepted | |
| ADR-005 | An Aspirational, Module-Independent Design System | Accepted | Superseded for current-state questions by `docs/UI_STANDARD.md`; corrected by ADR-023 (icon-library line) |
| ADR-006 | Modules as Self-Contained Units Within One Application | Accepted | |
| ADR-007 | A Generic Scheduler Service for Recurring Platform Jobs | Accepted | |
| ADR-008 | Google Drive Decoupling for NTR Legacy Import | Accepted | |
| ADR-009 | Machine Domain | Accepted, **Frozen** | Machine-as-aggregate-root is one of `20-ARCHITECTURE-GOVERNANCE.md`'s 5 Architecture Freeze items. **Kept this number** - see "ADR numbering normalization" below for why the collision was resolved by renumbering the *other* file instead |
| ADR-010 | Attachment Platform | Accepted, **Frozen** | `PLATFORM_ARCHITECTURE_STANDARDS.md` Foundation Freeze |
| ADR-011 | Address Platform | Accepted, **Frozen** (v2) | `PLATFORM_ARCHITECTURE_STANDARDS.md` Foundation Freeze; v1→v2 migration is this repo's own precedent for reopening a frozen layer via ADR |
| ADR-012 | Tractor IN as the Single Source of Truth for Product Family / Sub Model | Accepted | |
| ADR-013 | AuthorizationScope - Keeping Authorization Decisions Out of the Data-Access Layer | Accepted | |
| ADR-014 | Authentication Platform v3.0 | Accepted, **Frozen** (v3) | `PLATFORM_ARCHITECTURE_STANDARDS.md` Foundation Freeze, reopened-by-ADR precedent |
| ADR-015, ADR-016, ADR-019 - ADR-021 | *(reserved, not yet written)* | Reserved | `docs/architecture/blueprint/16-ADR-RECOMMENDATIONS.md` reserved seven numbers for specific named future domains: 015 Machine Domain v2, 016 Event Model, 017 Inspection Domain, 018 Knowledge Model, 019 Engineering Intelligence, 020 Analytics Domain, 021 Machine Digital Passport. 017 and 018 are now used (below). Note: 021 was actually used by `ADR-026-Machine-Digital-Passport.md` (merged, not reflected elsewhere in this index - a pre-existing drift in this file, not introduced here); kept reserved in this row until that's reconciled. **Do not use any of these remaining numbers for anything else** |
| ADR-017 | Inspection Domain (PDI) | Accepted, **Frozen** (v1.0, PR #45); reopened/amended by ADR-028 | `docs/releases/FOUNDATION_FREEZE_v1.1.md`; refines, does not replace, `docs/architecture/blueprint/04-INSPECTION-DOMAIN.md`; one stage inside ADR-027 (Machine Delivery Platform) |
| ADR-018 | Engineering Knowledge Platform (Knowledge Model) | Accepted, **Frozen** (v1.0, PR #42) | `docs/releases/KNOWLEDGE_FOUNDATION_FREEZE_v1.0.md`; refines, does not replace, `docs/architecture/blueprint/07-KNOWLEDGE-DOMAIN-AND-GRAPH.md` - see the ADR's own Decision table |
| ADR-022 | Import Platform v2 | **Proposed** (open PR #36, not yet merged) | References the Universal Import Framework by its *old* number (`ADR-009`) - needs updating to `ADR-024` once this governance PR merges, before PR #36 itself merges (see below) |
| ADR-023 | MSEAL Design Framework | **Proposed** (open PR #37, not yet merged; pre-merge refinement addendum already applied on that branch) | |
| ADR-024 | Universal Import Framework | Accepted | **Renumbered from `ADR-009`** by this normalization pass - see "ADR numbering normalization" below |
| ADR-025 | Canonical Event Catalog Consolidation | **Proposed** (this PR, #38) | See `docs/governance/EVENT_OWNERSHIP.md` and the ADR itself |
| ADR-026 | Machine Digital Passport | Accepted | Merged; consumes the ADR-021 reservation (see the reserved-range row above - a pre-existing drift, not introduced here) |
| ADR-027 | Machine Delivery Platform v1.0 | Accepted, **Frozen** (v1.0, PR #45); Warranty trigger amended by ADR-028 | `docs/releases/FOUNDATION_FREEZE_v1.1.md`; lifecycle orchestration - Tractor In through Warranty Activation; depends on ADR-017 (PDI) as one stage, never re-derives it |
| ADR-028 | Import Inspection Domain Correction | Accepted | Business-domain correction pass; reopens ADR-017, amends ADR-027's Warranty trigger; see `docs/architecture/INSPECTION_PDI.md`/`DELIVERY_PLATFORM.md` for the corrected, current architecture |
| ADR-029 | Quality Inspection Navigation Consolidation & Vehicle Master Data Expansion | Accepted | Reopens ADR-012 to extend Tractor IN sync to `product_code`/`wh_arrival_date`/`model`/`engine_number`/`dealer_id` on both insert and update; nav-only consolidation of the Delivery group into a Quality Inspection group; NTR/Import Inspection/Machine Passport read vehicle master data consistently; NTR gains an Edit screen |
| ADR-030 | Vehicle 360 Consolidation | Accepted | Retires the separate `/vehicles/[serial]` page (now a redirect) in favor of Machine Passport (`/machines/[machineId]`) as the one Vehicle 360 destination; adds an NTR section (`MachineService.getMachineNtrHistory()`, thin reuse of `fetchNtrRecordsForSerial()`) and Dealer to the renamed Vehicle Master section - no new table/service/timeline |
| ADR-031 | Platform Stabilization | Accepted | Post-ADR-028/029/030 cleanup: removes the now-unreachable General Delivery lifecycle UI + its 10 dead API routes, 150 orphaned translation keys, and dedupes Machine Passport's repeated per-serial MQR/PM/NTR reads via `React.cache()` - no new feature, no redesign |
| ADR-032 | v3.0 Foundation Hardening | Accepted | Architecture-hardening audit (no code change beyond documentation) confirming single ownership/no duplication/no circular dependency across Vehicle/Machine Passport/Import Inspection/NTR/Warranty/PM/MQR/Timeline/Documents; see `docs/architecture/V3_FOUNDATION_HARDENING_AUDIT.md` for the full audit, debt register, and v3.1/v3.2/v3.3 roadmap |
| ADR-033 | Customer Ownership (v3.1) | **Proposed, Phase 1 (schema) merged** | Designs a new Customer bounded context - `customers`/`customer_ownership_history` tables, additive nullable `vehicles.customer_id`. Phase 1 (schema) applied live, additive-only, zero data written. Phases 2-4 (backfill/dual-run/cutover) blocked on ADR-034's Legal/Compliance preconditions. See `docs/architecture/CUSTOMER_OWNERSHIP_PROPOSAL.md` |
| ADR-034 | Customer Data Governance (v3.1, Phase 1.5) | **Proposed** | Defines identity/ownership/visibility/PII/retention/deletion/correction/access-control/audit rules for the Customer entity ADR-033 built. No code, schema, or migration. Names 7 decisions requiring human/Legal approval before ADR-033 Phase 2 (backfill) may proceed. Tracked as individual decisions, each gated to an implementation phase, in `docs/architecture/CUSTOMER_COMPLIANCE_DECISION_REGISTER.md` |
| ADR-035 | Business Workflow & UX Audit (v3.1) | **Proposed** (open PR #57, not yet merged) | Evaluates the platform by the tractor's real lifecycle rather than by module. Finds a Warranty-Start-overwrite risk in the Tractor IN sync, three dead/unmodeled Delivery-lifecycle stages, a non-existent Troubleshooting workflow, and two small nav defects. No code/schema/API/UI change. See `docs/architecture/BUSINESS_WORKFLOW_UX_AUDIT.md` |
| ADR-036 | Business Workflow Consolidation (v3.1) | **Proposed** (this PR, audit only, not yet merged) | Sharper, field-level pass over ADR-035's ground: confirms `vehicles.dealer_id` is written exclusively by Tractor IN today (never by NTR) and `vehicles.delivery_date` can be silently overwritten by a later Tractor IN sync after NTR activation - both violate this milestone's stated field-scope rule, and both trace to ADR-029's deliberate `dealer_id` sync-scope extension, a real conflict flagged for explicit resolution. Confirms Repair/MQR Closed need zero new work. New companion `docs/architecture/BUSINESS_INVARIANTS.md`. No code/schema/API/UI change. See `docs/architecture/BUSINESS_WORKFLOW_CONSOLIDATION_AUDIT.md` |

**Next available number: ADR-037.**

## ADR numbering normalization (this pass)

**Defect found**: `docs/adr/ADR-009-Machine-Domain.md` (committed
2026-07-04) and `docs/adr/ADR-009-Universal-Import-Framework.md`
(committed 2026-07-03, one day earlier) both existed on `main` under the
same number - a real violation of "one ADR, one number, one topic."

**Resolution**: `ADR-009-Universal-Import-Framework.md` was renamed to
`ADR-024-Universal-Import-Framework.md`, **not** the chronologically
-earlier file. Reasoning: `ADR-009-Machine-Domain` is cross-referenced
roughly 25 times across the *frozen* Architecture Blueprint itself
(chapters 02, 10, 11, 13, 14, 16, 17, 20, and the blueprint's own README)
plus `PLATFORM_ARCHITECTURE_STANDARDS.md`, `PERMISSION_MATRIX.md`,
`DOMAIN_LANGUAGE_STANDARD.md`, `ADR-013`, `AI_CONTEXT.md`, and
`PROJECT_STATE.md`. Renumbering it would mean editing frozen Baseline
content for a documentation-hygiene fix - itself requiring 20's Breaking
Change Process, wildly disproportionate to the problem. The Universal
Import Framework ADR had exactly one real external cross-reference
(`docs/engineering/IMPORT_FRAMEWORK.md`, now updated) - renumbering it
resolves the collision with zero Baseline content touched.

**024 was chosen, not a smaller number**, because ADR-015-021 are
reserved (see index above) and ADR-022/ADR-023 are already claimed by
other in-flight PRs at the time of this fix.

**Known follow-up, not fixable from this PR**: `ADR-022-Import-Platform-v2.md`
(PR #36, an independent branch) references the Universal Import Framework
by its old `ADR-009` number, since it was written before this
renumbering. Whoever merges this PR (#38) should update PR #36's
reference to `ADR-024` before PR #36 itself merges - a real, tracked
action item, not silently left for someone to discover later.

## Verification

Every ADR number 001-014 and 024-025 above was checked against the
actual file list in `docs/adr/` at the time of writing (`ls docs/adr/`)
- no number in this index is asserted without a corresponding file
existing (except the explicitly-marked "reserved, not yet written" and
"proposed, open PR" rows, which say so). No duplicate number remains.

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
| ADR-015 - ADR-017, ADR-019 - ADR-021 | *(reserved, not yet written)* | Reserved | `docs/architecture/blueprint/16-ADR-RECOMMENDATIONS.md` reserved seven numbers for specific named future domains: 015 Machine Domain v2, 016 Event Model, 017 Inspection Domain, 018 Knowledge Model, 019 Engineering Intelligence, 020 Analytics Domain, 021 Machine Digital Passport. 018 is now used (below). Note: 021 was actually used by `ADR-026-Machine-Digital-Passport.md` (merged, not reflected elsewhere in this index - a pre-existing drift in this file, not introduced here); kept reserved in this row until that's reconciled. **Do not use any of these remaining numbers for anything else** |
| ADR-018 | Engineering Knowledge Platform (Knowledge Model) | **Proposed** (open branch `feature/engineering-knowledge-platform`, not yet merged) | Refines, does not replace, `docs/architecture/blueprint/07-KNOWLEDGE-DOMAIN-AND-GRAPH.md` - see the ADR's own Decision table |
| ADR-022 | Import Platform v2 | **Proposed** (open PR #36, not yet merged) | References the Universal Import Framework by its *old* number (`ADR-009`) - needs updating to `ADR-024` once this governance PR merges, before PR #36 itself merges (see below) |
| ADR-023 | MSEAL Design Framework | **Proposed** (open PR #37, not yet merged; pre-merge refinement addendum already applied on that branch) | |
| ADR-024 | Universal Import Framework | Accepted | **Renumbered from `ADR-009`** by this normalization pass - see "ADR numbering normalization" below |
| ADR-025 | Canonical Event Catalog Consolidation | **Proposed** (this PR, #38) | See `docs/governance/EVENT_OWNERSHIP.md` and the ADR itself |

**Next available number: ADR-026.**

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

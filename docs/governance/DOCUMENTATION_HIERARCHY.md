# Documentation Hierarchy

## Relationship to existing documents

Precedence rules already exist, scattered across multiple documents:
`docs/architecture/PLATFORM_CONSTITUTION.md` states "where this document
and an older one disagree, the newer, more specific decision governs";
`docs/architecture/MASP_ENTERPRISE_STANDARD.md` states "where this
document and `PLATFORM_CONSTITUTION.md` disagree on any other point,
`PLATFORM_CONSTITUTION.md`'s binding rules govern"; the Architecture
Blueprint's own README states the Blueprint is APPROVED/FROZEN as of its
merge. **This document does not override any of these - it consolidates
them into one visible hierarchy**, per `DOCUMENTATION_POLICY.md`'s own
rule to check for existing coverage before adding a new document.

## The Hierarchy

```
1. Platform Governance Framework      (docs/governance/ - this framework)
        │  operationalizes, does not override
        ▼
2. Architecture Blueprint v1.1        (docs/architecture/blueprint/01-20 + README)
        │  APPROVED, FROZEN as of PR #34's merge - a snapshot, not living
        ▼
3. ADRs                                (docs/adr/ADR-001 .. latest, see docs/adr/README.md)
        │  each one decision; frozen ADRs governed by the same Freeze as their subject
        ▼
4. Living Architecture Documents       (docs/architecture/*.md outside blueprint/,
        │                               e.g. PLATFORM_CONSTITUTION.md, MASP_ENTERPRISE_STANDARD.md)
        ▼
5. Standards                           (docs/standards/*.md - binding conventions)
        │
        ▼
6. Design Frameworks                   (e.g. MSEAL Design Framework, ADR-023 + its living doc)
        │
        ▼
7. Engineering Principles              (docs/PRODUCT_PHILOSOPHY.md, blueprint 01)
```

Layer 1 (this framework) is new as of this pass. Layers 2-7 already
existed; this diagram is the first place they're drawn as one ordered
stack.

## Precedence Rules (consolidated, not new)

1. **A frozen item always wins over a non-frozen document that
   contradicts it**, regardless of layer - e.g. a Standard (layer 5)
   cannot casually redefine something the Architecture Freeze (layer 2)
   already decided; that requires the Breaking Change Process (20),
   full stop.
2. **Within the same layer, the newer, more specific decision governs**
   - `PLATFORM_CONSTITUTION.md`'s own rule, generalized: a later ADR
     supersedes an earlier living document's wording on the same point
     (ADR-011 v2 superseding `MASP_ENTERPRISE_STANDARD.md`'s Address
     Platform wording is the existing, cited precedent), but never
     silently - the disagreement itself gets a new ADR recording which
     one wins, per `PLATFORM_CONSTITUTION.md`'s own words: "the
     disagreement itself should be resolved with a new ADR, not by
     silently picking one."
3. **This governance framework (layer 1) never contradicts layer 2/3
   content** - every governance document in this framework states
   explicitly what it extends vs. cites vs. deliberately does not
   restate (`DOCUMENTATION_POLICY.md`'s verification checklist). If a
   future governance document would need to contradict a frozen item to
   make sense, that is a signal the frozen item itself needs a Breaking
   -Change-Process review - not something the governance layer can
   settle unilaterally by being "above" it. "Above" here means *broader
   scope*, not *higher authority to override a Freeze*.
4. **A document's own explicit precedence statement wins over this
   consolidated diagram** if the two ever conflict - this document
   summarizes, it does not supersede, `PLATFORM_CONSTITUTION.md`'s and
   `MASP_ENTERPRISE_STANDARD.md`'s own precedence clauses.

## How to use this when two documents disagree

1. Check whether either document is a Freeze item (20's 5 items,
   `PLATFORM_CONSTITUTION.md`'s Foundation Freeze). If yes, that one wins
   regardless of layer or recency, unless changed via the Breaking
   Change Process.
2. If neither is frozen, the higher layer number (further down this
   list, i.e. more specific/operational) usually reflects a more
   detailed, later decision - but check dates and existing explicit
   precedence clauses (rule 4) before assuming.
3. Record the resolution as a new ADR if the disagreement is
   substantive (changes what a reader should do) - not for a typo-level
   fix.
4. Never resolve a disagreement by quietly editing one document to match
   the other with no note - that is exactly the class of drift
   `DOCUMENTATION_POLICY.md` and this pass's own fixes (ADR-009 dup,
   event catalog drift, repo-visibility drift) exist to prevent from
   recurring.

## Gap Analysis

- This hierarchy is descriptive of existing, scattered precedence
  clauses - it is not itself a new binding rule beyond consolidating
  them into one visible diagram. If a future document's precedence
  clause contradicts this diagram, fix the diagram, not the document
  (rule 4).

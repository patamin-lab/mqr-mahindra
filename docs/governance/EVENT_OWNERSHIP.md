# Event Ownership

## Relationship to existing documents (a real, pre-existing drift)

Two documents already claim to be a canonical event catalog, and they
disagree:

| | `docs/standards/EVENT_CATALOG.md` | `docs/architecture/blueprint/18-CANONICAL-EVENT-CATALOG.md` |
|---|---|---|
| Status | Binding-but-secondary ("human-readable index... if they [this doc and the DB] ever disagree, the database is authoritative") | Frozen (event *ownership* is one of 20's 5 Architecture Freeze items) |
| Naming convention | `event_code`, UPPER_SNAKE_CASE (`MQR_OPENED`, `FACTORY_BUILD`) | `PlatformEventType`, PascalCase (`MQROpened`, `MachineImported`) |
| Scope | Vehicle Life Cycle Timeline events - broad, includes `NTR_CREATED`/`NTR_COMPLETED`, `CAMPAIGN_*`, `PART_*`, `TELEMATICS_ALERT`, `SOFTWARE_UPDATE` | Machine Lifecycle events specifically - 13 named types, includes `ImportPDICompleted`, `DealerPDICompleted`, `WarrantyActivated`, `PIPCreated`/`PIPCompleted`, `OwnershipTransferred` |
| Cross-references the other? | No | No - it does say 06 (Event Model) is superseded for these 13 events, but never mentions `docs/standards/EVENT_CATALOG.md` at all |
| Ownership statement | Publisher status per event ("MQR/PM not yet wired; NTR is first end-to-end") | "Every event type has exactly one owning module - the only bounded context permitted to emit it" (quoted) |

**This document does not merge them, rewrite either of them, or pick a
winner unilaterally** - 18's content is frozen (one of 20's 5 Freeze
items), so changing its event names/ownership is a Breaking Change per
20's own process, not something a documentation-only governance pass
does. Instead, this document names the drift precisely and proposes a
reconciliation rule for whoever holds the authority to act on it.

## Canonical Events (as they exist today, both catalogs)

For any new event, check **both** catalogs before naming it - a name
that exists in one under a different casing/spelling than the other
(e.g. `PMCompleted` in spirit vs. `MAINTENANCE_COMPLETED` literally) is
exactly the kind of silent duplication this framework exists to prevent.

- **`docs/architecture/blueprint/18-CANONICAL-EVENT-CATALOG.md`** governs
  Machine Lifecycle event *names* and *ownership* - one owning module per
  event type, frozen.
- **`docs/standards/EVENT_CATALOG.md`** governs the Activity Timeline's
  broader `event_code` taxonomy (which includes non-lifecycle,
  operational events like `TELEMATICS_ALERT`) - the database
  (`event_definitions` table) is authoritative over this document itself.

## Owners (per 18, unchanged, cited not restated)

Each of 18's 13 `PlatformEventType`s has exactly one owning module (the
sole permitted producer) - see 18 directly for the full table. This
document does not reproduce it verbatim to avoid the two documents
drifting further apart the next time one of them is edited and the other
isn't.

## Publishers / Consumers

- **Publishers**: exactly the owning module named in 18 for
  Machine-Lifecycle events; whichever module's repository/service layer
  calls `logAuditEvent()`/`logAuditEvents()` for Activity-Timeline-scoped
  events (`EVENT_CATALOG.md`'s "which modules actually publish today"
  section - MQR, PM, NTR at various stages of completeness).
- **Consumers**: Timeline (both catalogs), Knowledge (07, Machine
  -Lifecycle events only), Analytics (09), Engineering Intelligence (via
  Knowledge only, never events directly - 08's "no independent data of
  its own" rule applies here too).

## Naming Standards (proposed, not yet binding - see reconciliation below)

Until the two catalogs are reconciled, a new event should:

1. Check both catalogs for an existing name for the same fact - do not
   invent a third naming convention for a fourth "index."
2. If the event is a Machine Lifecycle event (fits one of 18's 13
   named stages), extend 18 - PascalCase, past tense, one owning module
   (18's existing convention).
3. If the event is a Timeline/operational event outside Machine
   Lifecycle scope, extend `docs/standards/EVENT_CATALOG.md` -
   UPPER_SNAKE_CASE `event_code`, added to the `event_definitions` table
   first (DB is authoritative).
4. Never emit an event that already has a name in the *other* catalog
   under different casing for the same fact - if in doubt, this is
   exactly the kind of ambiguity to raise before writing code, not after.

## Versioning Rules

Neither existing catalog states an explicit event-versioning rule (both
are silent on "what happens when an event's shape/metadata needs to
change"). Proposed, consistent with 20's Breaking Change Process: an
event's **name and ownership** are frozen (18) - changing either is
always a Breaking Change, full ADR process, no exception. An event's
**metadata shape** is not itself frozen (18 explicitly leaves "exact
`metadata` shape per event" undecided) - additive metadata fields are a
domain-local change for the owning module; removing or renaming an
existing metadata field is a Breaking Change (it can silently break every
consumer that reads it).

## Proposed Reconciliation (recommendation only - not executed here)

1. Add an explicit cross-reference from `docs/standards/EVENT_CATALOG.md`
   to 18, and vice versa, stating which one governs which event scope
   (as this document already does above) - a documentation-only fix,
   low risk.
2. For the events that exist in both under different names for the same
   real-world fact, pick one canonical name and alias the other as
   deprecated - this **is** a Breaking Change for 18's frozen content, so
   it needs 20's ADR process even though the fix looks trivial.
3. Do not attempt step 2 as part of a documentation-only pass (this one)
   - flagged in `README.md`'s Governance Roadmap as a "Next" item, owned
   by whoever holds 18's Breaking Change authority.

## Gap Analysis

- The drift itself (two catalogs, no cross-reference, overlapping but
  non-identical event sets) is the primary finding of this document -
  see table above.
- No machine-readable `PlatformEventType` union type exists yet (18
  explicitly leaves this undecided) - a real future gap, not resolved
  here.
- No versioning rule existed before this document; the "Versioning
  Rules" section above is new governance guidance, not a restatement of
  an existing rule - flag it as *proposed* until whoever owns 18/20
  confirms it.

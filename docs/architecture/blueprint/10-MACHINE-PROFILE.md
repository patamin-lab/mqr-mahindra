# 10 — Machine Profile

## What it is

The Machine Profile is the future single page a Dealer/Central engineer
opens to understand *everything* about one Machine — the concrete UI
realization of "Machine is the primary entity" (01, Principle 1). It is
an **aggregation page**, not a new source of truth: every section reads
from an existing (or blueprint-proposed) domain's own service, exactly
the way today's `Vehicle360Page`/`Machine360Page`
(`src/app/(app)/vehicles/[serial]/page.tsx`, per ADR-009) already
aggregates Summary + Timeline + Attachments from three separate provider
sources without owning any of that data itself.

## Aggregates

```
Machine Profile
  ├── Machine            — Registry/Configuration (02) via MachineService
  ├── Customer           — current + historical owner (Ownership, 02)
  ├── Dealer              — current servicing dealer (DealerBranchScope — frozen platform layer, unchanged)
  ├── Inspection          — via InspectionService (04)
  ├── Warranty            — via calcWarranty() today; a real Warranty module later (05, 14)
  ├── PM                  — via MaintenanceService (existing)
  ├── MQR                 — via MQR's existing provider (existing)
  ├── PIP                 — via PipService (05)
  ├── Timeline            — Machine Timeline (03), fed by the Event Model (06)
  ├── Knowledge           — relevant KnowledgeCases for this machine's model/family (07)
  └── AI Insight          — IntelligenceService recommendations for this machine's open issues (08)
```

## Relationship to today's Machine 360

This is the **direct successor** to the already-shipped Machine 360 page
(ADR-009) — not a competing design. Machine 360 today aggregates
Summary + Timeline + Attachments via `MachineService`; the Machine
Profile is that same page's scope extended to include Inspection,
Knowledge, and AI Insight once those domains exist. No rewrite of
`MachineService`'s existing methods is implied — new sections are new
methods added to the same facade (`getInspectionsForMachine()`,
`getKnowledgeForMachine()`, `getAiInsightsForMachine()`), following the
exact pattern `getMachineAttachments()` already established (parallel
per-domain fetches merged in application code, never a cross-context SQL
join — 02's Repository Boundaries rule).

## Composition, not a god-service

`MachineService` remains a **thin aggregator**. It never contains
Inspection/Knowledge/AI business logic itself — it calls
`InspectionService`, `KnowledgeService`, `IntelligenceService`, each
already responsible for its own domain (02, 04, 07, 08), and assembles
the page-shaped result. This is the same discipline
`getMachineAttachments()` already demonstrates today (calling
MQR/PM/NTR's own scoped utilities, never querying their tables
directly) — the Machine Profile is that pattern applied to more domains,
not a new pattern.

## UI reuse, not a new component tree

- **Timeline section** reuses `<ActivityTimeline>` unchanged (03) —
  this is exactly the "future Vehicle 360 compatibility" that component
  was built for.
- **Attachments section** reuses `AttachmentGallery`/`AttachmentService`
  unchanged (Foundation Frozen, `PLATFORM_CONSTITUTION.md`).
- **AI Insight section** reuses the Evidence-First presentation pattern
  from 08 — confidence, evidence, supporting cases, never a bare score.

## Explicitly not decided here

- Exact page layout/section ordering — a UI design decision for
  whichever phase (13) actually builds this, not an architecture
  question.
- Whether the route stays `/vehicles/[serial]` (matching ADR-009's
  explicit decision not to change the URL for a terminology-only
  change) or becomes `/machines/[serial]` — if this phase's scope ever
  grows beyond "more data on the same page" into a genuinely new
  information architecture, that's a real product decision to make at
  that time, not implied by this blueprint.

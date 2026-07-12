# Machine Digital Passport — Architecture

v1.0. See `docs/adr/ADR-026-Machine-Digital-Passport.md` for the decision
record this document expands on. Builds directly on the frozen foundation:
Architecture Blueprint v1.1, Platform Governance v1.1, MSEAL Design
Framework v1.1, Navigation Standard, Dashboard Standard, Authentication
Platform v3.x, Import Platform Foundation. No frozen document was modified
to build this.

## What this is

`/machines/[machineId]` (`machineId` = Serial Number) is the permanent home
of one machine across its whole lifecycle - Identity, Lifecycle, Ownership,
Warranty, Preventive Maintenance, Quality, Documents, an Activity Timeline,
and placeholder Knowledge Integration / Future IoT sections. It is an
**aggregation layer**, exactly like Vehicle 360 before it: it owns no data
of its own and runs no query that isn't already scoped by an existing
module's own read function.

## Data flow

```
                          MachineService (features/machine/service.ts)
                                       (ADR-009 facade)
                                            │
        ┌────────────────┬─────────────────┼──────────────────┬────────────────┐
        ▼                ▼                 ▼                  ▼                ▼
getVehicleSummary   getVehicleTimeline  fetchMqrRecords   fetchMaintenance   fetchNtrRecords
(vehicle/service)   (vehicle/service)   (mqrEvents.ts)    HistoryForSerial   ForSerial
                                                           (maintenance)      (ntr)
        │                │                 │                  │                │
        └── MachineSummary                 └── MqrRecord[] ───┴── warranty/quality/PM
             (Identity/Ownership/                                  derivations
              Lifecycle-signal fields)
                                            │
                                   listAuditLogForRecords (lib/db.ts, new)
                                            │
                                   mapMixedAuditLogToActivityEvents
                                   (components/shared/activity-timeline)
                                            │
                                     ActivityEvent[]  →  <ActivityTimeline>
```

Nothing here bypasses an existing module's own scoped read. `MachineService`
is the *only* new query surface, and it is three thin aggregation methods
(`getMachineWarrantySummary`, `getMachineQualitySummary`,
`getMachineAuditTimeline`) plus the two that already existed
(`getMachine360`, `getMachineTimeline`, both pre-dating this build).

## Page composition & lazy loading

`src/app/(app)/machines/[machineId]/page.tsx` fetches three things up
front, in one `Promise.all` (all cheap - a single provider-aggregation
call, the existing milestone timeline, and one vehicle row lookup for the
Variant field):

- `MachineSummary` (feeds Identity, Lifecycle's stage badges, Ownership)
- the milestone timeline (feeds Lifecycle's timeline sub-section)
- the raw `vehicles` row (feeds Identity's Variant field only)

Everything else - Warranty, Preventive Maintenance, Quality, Documents,
Activity Timeline - is each its own small async Server Component
(`features/machine/components/sections/Machine*Section.tsx`), individually
wrapped in `<Suspense fallback={<Skeleton .../>}>` on the page. This means:

- A slow Activity Timeline query (the heaviest - it reads every MQR/PM/NTR
  record id for the machine, then bulk-queries `record_audit_log` per
  module) never blocks Identity/Lifecycle/Ownership from painting first.
- Each section fails/loads independently - a Warranty query error doesn't
  take down the Quality section next to it (React error boundaries per
  Suspense boundary is a natural follow-up, not yet added in v1.0 - see
  "Known gaps" below).
- No new caching layer was introduced; each section reuses whatever
  caching its underlying read already had (none, today - matching Vehicle
  360's own behavior. `force-dynamic` is set on the page, same as Vehicle
  360).

Knowledge Integration and Future IoT have no data source at all, so they
render synchronously (no `Suspense` needed - there's no query to await).

## Two timelines, not one

The Lifecycle panel reuses the **existing** milestone timeline verbatim
(`MachineService.getMachineTimeline()` → `vehicle_events` →
`MachineTimelineRow`, the same component/query Vehicle 360 already used -
extracted, not duplicated, from Vehicle 360's previously-local
`TimelineRow`). The new Activity section is a **different** feed:
`record_audit_log` field-level changes across this machine's own MQR/PM/NTR
records, mapped through the same `mapMixedAuditLogToActivityEvents()`
adapter Platform Overview's "Today's Activities" widget already uses, and
rendered through the platform-standard `<ActivityTimeline>` component
(MSEAL Design Framework, ADR-023).

These are deliberately not merged:

| | Milestone timeline (Lifecycle) | Activity Timeline (new) |
|---|---|---|
| Source table | `vehicle_events` | `record_audit_log` |
| Granularity | One row per business milestone (NTR Created, MQR Opened, ...) | One row per field/status/photo change |
| Component | `Timeline`/`TimelineItem`/`MachineTimelineRow` | `<ActivityTimeline>` |
| Scope today | NTR fully wired; MQR/PM via bespoke adapters | MQR/PM/NTR, uniformly, via `record_audit_log` |

Merging them would either drop the fine-grained detail the Activity feed
carries, or force `vehicle_events` rows to carry diff payloads they were
never designed for. Two clearly labeled sections instead.

## Permissions

No new authorization model. Every read goes through the same
`AuthorizationScope`/`resolveDealerScope` dealer-scoping every other
module already uses - `getVehicleSummary`, `fetchMqrRecords`,
`fetchMaintenanceHistoryForSerial`, and `fetchNtrRecordsForSerial` each
apply their own existing scope check; the Passport page never queries a
table directly. A machine outside the caller's dealer scope returns
`summary === null`, and the page renders the same "not found" shape
Vehicle 360 already uses for that case - it does not distinguish "doesn't
exist" from "exists but you can't see it," matching Vehicle 360's existing
behavior (avoids leaking existence).

## Known gaps (v1.0, not silently deferred)

- No per-section error boundary yet - a thrown error inside one `Suspense`
  boundary currently bubbles to the Next.js route error boundary for the
  whole page, not just that section. Acceptable for v1.0 since every
  underlying read already has its own error handling; flagged as a
  follow-up once a second Passport-like page exists to justify a shared
  `<SectionErrorBoundary>`.
- No response caching beyond what already existed. If this page's load
  time becomes a real problem, the individual `Machine*Section` components
  are the natural seam to add `unstable_cache`/tag-based revalidation to,
  one at a time, without touching the page shell.
- See `docs/architecture/MACHINE_DATA_OWNERSHIP.md` for the data-model
  gaps (Manufacturing Year/Country, Variant, Ownership History) and
  `docs/architecture/MACHINE_LIFECYCLE.md` for the lifecycle-stage
  derivation gaps (Registered vs. Delivered, PIP, Recall).

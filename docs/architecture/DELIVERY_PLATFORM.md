# Machine Delivery Platform v1.0 - Architecture

ADR-027. The complete digital delivery lifecycle - Tractor In through
Warranty Activation. PDI is one stage inside this lifecycle
(`docs/architecture/INSPECTION_PDI.md`, ADR-017), not redesigned here.

Structured around the task brief's own ten requested Output sections.

## 1. Machine Delivery Architecture

Machine remains the platform center (ADR-009, unchanged). Delivery is a
new lifecycle-tracking aggregate (`delivery_records` +
`delivery_trainings`) that **orchestrates**, never duplicates, every
stage's real owner:

```
Manufacturing
  |
Tractor In           -> vehicles (ADR-012, TractorInSyncService) - read only
  |
Stock Yard           -> delivery_records (new)
  |
PDI                  -> inspections (ADR-017) - linked, not duplicated
  |
Delivery             -> delivery_records (Dealer Preparation, Customer
  |                     Delivery link to ntr_records, Operator Training,
  |                     Delivery Acceptance)
Warranty              -> delivery_records.warranty_activated_at (new
  |                     point-in-time event) + vehicles.delivery_date-
  |                     driven calcWarranty() (unchanged, still live)
PM / Quality / Knowledge / IoT
  (unchanged - existing Machine Passport sections; Delivery adds one more
  read-only section, does not touch these)
```

Every activity contributes to the Machine Passport (§5), the shared
Timeline (§6), and may create Knowledge (§7) - the task's own Platform
Principles, satisfied by reuse, not new infrastructure.

## 2. Delivery Lifecycle

`delivery_records.stage`, one column, nine values, one direction (no
skipping backward):

1. **Tractor In** - `createDeliveryRecord()`: reads the vehicle (already
   synced via ADR-012), starts tracking. Default stage on row creation.
2. **Stock Yard** - `receiveAtStockYard()`: location + timestamp.
3. **PDI** - `linkInspection()`: links an `inspections` row. Stage stays
   `PDI` until the linked Inspection's own `status` is `Completed`, then
   advances.
4. **Dealer Preparation** - `completeDealerPrep()`: notes + timestamp.
5. **Customer Delivery** - `linkNtr()`: links an `ntr_records` row
   (Customer/Machine/Photos/Delivery Date already captured there - never
   re-entered).
6. **Operator Training** - `recordTraining()`: creates a
   `delivery_trainings` row (§4), links it.
7. **Delivery Acceptance** - `recordAcceptance()`: gated by
   `canApproveDelivery`; auto-triggers stage 8.
8. **Warranty Activation** - `activateWarranty()`: one timestamp +
   source (`DeliveryAcceptance` or `Manual`) - not a claims/policy ledger.
9. **Completed** - `overall_status: 'Completed'`.

## 3. PDI Architecture

See `docs/architecture/INSPECTION_PDI.md` in full. Summary: one
`inspections` aggregate (ADR-017), Checklist/Findings/Evidence/
Measurements/Parts Replacement/Digital Sign-off/Checklist Version/
Technician Certification/Dealer Approval - all real, all tested. Delivery
links an Inspection by ID; it never queries or writes `inspections`
directly.

## 4. Training Architecture

`delivery_trainings` (child of `delivery_records`, cascade-deleted with
it): Training Topics (`[{topic, covered}]`), Operator (name + phone),
Trainer (name + optional ID), Training Date, Training Duration
(minutes), Customer Satisfaction (1-5). Training Photos/Videos reuse the
Attachment Platform (`module: 'delivery'`, `entityType:
'DeliveryTraining'`) - no URL columns on the table itself, unlike NTR's
older hardcoded-photo-column pattern (a deliberate modernization, per the
task's own "modernize it" instruction for delivery-adjacent capture).

## 5. Machine Passport Integration

`MachineService.getMachineDeliverySummary(serial)` -> thin facade ->
`DeliveryService.getDeliveryForMachine(serial)` - read-only, latest
delivery record for this serial. New `MachineDeliverySection` (async
Server Component, own `<Suspense>` boundary), inserted immediately before
the existing Warranty section (Machine Passport v1.5) - matching the
real-world chronology the task brief itself states (Tractor In -> ... ->
Delivery -> Warranty). Machine owns none of this data.

## 6. Timeline Integration

Zero new table. `AuditModule` (`lib/types.ts`) widened from `'mqr'|'pm'|
'ntr'|'knowledge'` to add `'pdi'|'delivery'`. Every mutating
`InspectionService`/`DeliveryService` method writes through the existing
`logAuditEvent()`/`logAuditEvents()` into `record_audit_log`. `
<ActivityTimeline>` and its mapper needed zero changes - confirmed
module-agnostic (the same claim ADR-018 made for Knowledge, re-verified
here).

## 7. Knowledge Integration

Inspection Findings promote to Knowledge Candidates through
`KnowledgeService.createCandidate()`/`.addEvidence()` directly (ADR-017
§4) - "do not duplicate entry," satisfied by calling the existing public
write API, not building a second one. `knowledge_evidence.source_type`
widened to add `'Inspection'` and `source_module` to add `'pdi'` -
additive CHECK constraint changes only, no change to `KnowledgeService`/
`KnowledgeRepository` code. This is the Knowledge Foundation Freeze
v1.0's own documented Extension path ("adding a new Evidence source
type"), not a violation of the freeze.

## 8. Dashboard

`/delivery/dashboard` - KPIs computed by `DeliveryService.
getDashboardStats()`, reusing `dashboardStats()`/`buildLeaderboard()`'s
JS-side aggregation shape (`lib/db.ts`), not a second reporting engine:

- **Pending Delivery** - count where `stage !== 'Completed'`.
- **Pending PDI** - count where `stage` is `StockYard` or `PDI`.
- **Pending Training** - count where `stage === 'OperatorTraining'`.
- **Warranty Pending** - count where `stage === 'WarrantyActivation'`.
- **Delivery Quality** - PDI Pass rate among inspections with a result.
- **Dealer Ranking** / **Technician Ranking** - sorted leaderboards, same
  shape as Quality Dashboard's own dealer/technician leaderboards.

Reports (`/delivery/reports`): all 7 named report types (Dealer/
Technician/Model/Checklist Version/Delivery Duration/Training
Completion/Warranty Activation) are filters/columns of **one**
consolidated `DeliveryReportRow` dataset - Reuse-before-Build, not 7
separate report pipelines. CSV export reuses the existing shared
`buildCsv()` (`lib/exportCsv.ts`).

## 9. Migration Plan

**No data migration was executed by this PR** - there is no accessible
AppSheet export anywhere in this repository or this environment (see
ADR-017's Problem section; flagged explicitly, not fabricated, matching
the Import Platform v2 task's own precedent for a missing source file).

Intended cutover, once an AppSheet export becomes available:
1. **Dual-run period** - both systems accept new PDI/delivery entries
   while historical data is exported from AppSheet.
2. **Freeze new entry in the legacy system** once this platform is
   verified in production - no new PDI/delivery records created outside
   this platform from that point.
3. **One-time historical import**, adapted from NTR's existing Legacy
   Import pipeline (`src/shared/import/`, ADR-009/ADR-024) rather than a
   new import engine - the same "reuse before build" discipline this
   epic applied everywhere else.
4. **Verification**: row-count reconciliation against the AppSheet
   export, spot-check a sample of imported Inspections/Deliveries against
   their original source before treating the cutover as complete.

This plan is not executed - it is the recommended path once the missing
input (an AppSheet export) exists.

## 10. Future AI Integration

Reserved only - zero implementation, matching Knowledge's own AI
precedent. `DeliveryFutureAiPanel`: 4 Coming Soon tiles - **AI Delivery
Review**, **AI Delivery Risk**, **AI Readiness**, **AI Recommendation** -
same `Card`+`EmptyState comingSoon` shape as `KnowledgeFutureAiPanel`,
each captioned "AI must always cite Evidence." Any future AI capability
here inherits the Knowledge Foundation Freeze's AI Contract (never owns
Knowledge/Delivery data, never becomes the Source of Truth, consumes
through the existing services only, never bypasses them).

## Production Readiness Recommendation

**PASS WITH WARNINGS.** Core lifecycle (Tractor In -> Stock Yard -> PDI
-> Dealer Preparation -> Customer Delivery -> Operator Training ->
Delivery Acceptance -> Warranty Activation -> Completed) is real, tested,
and integrated into Machine Passport, Timeline, and Knowledge. Explicitly
deferred: Import PDI UI, full Warranty claims/policy ledger, Technician
Certification management, checklist template builder, AI Delivery
Review/Risk/Readiness/Recommendation implementation, AppSheet data
migration execution (no export available).

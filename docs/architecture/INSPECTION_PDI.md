# Inspection Domain (PDI) - Architecture

ADR-017. Reconciles `docs/architecture/blueprint/04-INSPECTION-DOMAIN.md`
(frozen Architecture Baseline). One stage inside the Machine Delivery
Platform (`docs/architecture/DELIVERY_PLATFORM.md`), not a standalone
capability.

## 1. Domain Model

One aggregate, one table: `inspections`.

| Field | Notes |
|---|---|
| `inspection_ref` | `PDI-<year>-######`, dealer-scoped `next_job_seq()` bucket |
| `inspection_type` | `DEALER_PDI` (targeted this epoch) / `IMPORT_PDI` (schema-ready, no UI) |
| `vehicle_id` + `serial` | FK `vehicles.id`, plus denormalized `serial` for reverse lookup |
| `dealer_id` | FK `dealers.id` |
| `status` | `Scheduled` / `InProgress` / `Completed` / `Cancelled` |
| `result` | `Pass` / `Fail` / `Conditional` - set on `completeInspection()`, never hand-picked |
| `checklist_version` | e.g. `PDI-CL-v1` - one seeded default template ships this epoch |
| `checklist` (JSONB) | `[{id, category, label, result: Pass\|Fail\|NA\|null, remark}]` |
| `findings` (JSONB) | `[{id, severity, system, description, knowledgeCaseId}]` - `severity` reuses the platform's existing `Severity` type, no second vocabulary |
| `measurements` (JSONB) | `[{id, parameter, value, unit, specMin, specMax, inRange}]` |
| `parts_replaced` (JSONB) | `[{id, partName, partNumber, qty, reason}]` |
| `technician_name`/`technician_certification_ref` | Certification is a free-text reference only - no certification-management module |
| `signed_off_by`/`signed_off_at` | Digital Sign-off - open to the performing technician |
| `dealer_approved_by`/`dealer_approved_at` | Dealer Approval - gated by `canApproveDelivery` |
| `related_ntr_id` | Optional FK, when PDI happens alongside NTR creation |

## 2. Lifecycle

`Scheduled -> InProgress -> Completed` (or `Cancelled` at any point).
`completeInspection()` requires every checklist item to have a non-null
`result` before allowing completion, and derives `result` from the
checklist/findings (`Fail` if any checklist item fails and a Finding was
recorded; `Conditional` if a checklist item fails with no Finding;
`Pass` otherwise) - never silently `Pass` on a failed item.

Sign-off requires `status === 'Completed'`. Dealer Approval requires
Sign-off to have happened first, and is gated server-side by
`canApproveDelivery` (`lib/scope.ts`: SuperAdmin/CentralAdmin/DealerAdmin).

## 3. Evidence (Attachments)

Reuses the existing Attachment Platform directly - `AttachmentService`
with `module: 'pdi'`, `entityType: 'Inspection'`. The `'pdi'` retention
policy (365 days) was pre-seeded in `attachment_retention_policies`
before this epoch existed, anticipating exactly this build.

## 4. Knowledge Integration

"Structured Findings may become Knowledge Candidates... do not duplicate
entry" (task brief). `InspectionService.promoteFindingToKnowledge()`
calls `KnowledgeService.createCandidate()` then `.addEvidence()`
directly - `source_type: 'Inspection'`, `source_module: 'pdi'` - and
stores the resulting `knowledgeCaseId` back onto the Finding. There is no
second Knowledge-entry form anywhere in this module.

## 5. Screen Contract

- **`/delivery/pdi`** (list) - filters: status/serial/technician search.
- **`/delivery/pdi/new`** (create) - serial + technician + certification
  reference -> `Scheduled`, seeded checklist.
- **`/delivery/pdi/[id]`** (detail) - Checklist editor (Pass/Fail/N/A +
  remark per item), Findings (add + Promote to Knowledge), Measurements
  (add, auto in-range check), Parts Replacement (add), Evidence
  (`AttachmentViewer`), Complete/Sign-off/Dealer Approval actions,
  `<ActivityTimeline entityLabel="PDI">`.

## 6. Governance

Owned by the Inspection domain (this ADR), not by Quality, Delivery, or
Machine. Delivery links an Inspection by ID; it never queries or writes
`inspections` directly (`DeliveryService`/`DeliveryRepository` never
reference the table). Exactly one nav entry (`/delivery/pdi`, under the
Delivery nav group), never duplicated under Quality or Engineering
Intelligence.

## 7. Architecture Notes

Relationship to ch.04: same generic `Inspection` entity/table shape, same
`inspection_type` enum values, same optional NTR link. This build adds
what ch.04 left unspecified (findings/measurements/parts replacement/
sign-off/dealer approval/technician certification/checklist version) as
additive JSONB/text columns on the same row - no second table, no forked
model.

## 8. Production Readiness Recommendation

**PASS WITH WARNINGS.** Core PDI workflow (checklist -> findings ->
measurements -> parts -> sign-off -> dealer approval -> Knowledge
promotion) is real, tested, and wired into the Delivery lifecycle and
Machine Passport. Explicitly deferred: Import PDI UI, checklist template
builder/admin UI (one seeded default ships), Technician Certification
management beyond a free-text reference.

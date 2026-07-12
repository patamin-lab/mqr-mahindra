# Machine Data Ownership

v1.0. Every field the Machine Digital Passport shows, where it actually
comes from, and - honestly, not optimistically - which fields it *can't*
show yet because no owning table/column exists. Written so a future
contributor never has to grep the schema to find out whether a gap is a
bug or a known, documented limit.

## Principle: the Passport owns nothing

`MachineService` and every Passport panel are a read-only aggregation
layer, same as Vehicle 360 before it. No new table was created for this
build. Every field below is either read from an existing table/column, or
computed from existing fields (`calcWarranty()`, `OPEN_STATUSES`
membership) - or it is a documented gap.

## Field ownership

| Passport field | Owning source | Notes |
|---|---|---|
| Serial Number | `vehicles.serial` | Natural key, synced from Tractor-IN sheet |
| Engine Number | `vehicles.engine_number` | |
| Model | `vehicles.model` | |
| Product Family | `product_families` (via `vehicles.product_family_id`) | |
| Variant | `vehicles.sub_model` | Closest existing analog - **not** a true "Variant" concept (see Gaps) |
| Manufacturing Year | — | **Gap** - no column anywhere |
| Manufacturing Country | — | **Gap** - no column anywhere |
| Current Owner / Owner Phone | Latest MQR/PM/NTR record's `customer_name`/`customer_phone` | Derived read-time, not a stored FK - see "Ownership has no identity" below |
| Owner History | — | **Gap** - no ownership-history table |
| Dealer / Branch | `vehicles.dealer_id`/`branch_id` (resolved to names via `dealers`/`branches`) | |
| Region | — | **Gap** - no `region` column on `dealers`/`branches`/`vehicles` |
| Warranty Status/Age/Limit | Computed by `calcWarranty()` off `vehicles.delivery_date` (`'powertrain'` coverage) | No dedicated warranty table - see below |
| Warranty Claims | `records` (MQR) rows with a non-null `warranty_status` | Per-complaint snapshot, not a claims ledger |
| PM Completed/History | `pm_records` for this serial | |
| PM Upcoming/Overdue/Compliance | Computed by `MaintenanceDueService`/Vehicle 360 aggregation | Existing logic, not re-derived |
| Quality Open/Closed/Critical/Cases | `records` (MQR) for this serial, `OPEN_STATUSES`/`severity` | |
| Documents/Photos | `AttachmentService` (ADR-010) across this machine's MQR/PM/NTR records | Split into Photos/Other by MIME type, not a real document-category field (see Gaps) |
| Activity Timeline | `record_audit_log` across this machine's MQR/PM/NTR records | New bulk read (`listAuditLogForRecords`), same table/shape as every other `<ActivityTimeline>` consumer |
| Milestone timeline | `vehicle_events` (existing, unchanged) | |

## Ownership has no identity table

There is no `customer_id` foreign key anywhere in this schema - "Owner" is
always a free-text `customer_name`/`customer_phone` snapshot on whichever
MQR/PM/NTR record happens to be most recent for the serial. Two
consequences, both inherited unchanged from Vehicle 360 (not introduced by
the Passport):

- Two records for the same real customer with slightly different
  spelling/formatting of their name are indistinguishable to the system -
  there is no canonical Customer entity to de-duplicate against.
- "Owner History" (a list of past owners over time) cannot be built
  without either a new Customer entity + FK, or a purpose-built ownership-
  transfer event (the milestone timeline's type list already reserves
  `Other` for exactly this kind of not-yet-modeled event, but no module
  writes it today).

Both are called out as gaps, not solved here - solving them is a Customer/
Owner Identity Platform-sized decision, out of scope for "add the
Passport page."

## No dedicated Warranty table

Warranty status shown on the Passport is **computed**, not stored:
`calcWarranty(deliveryDate, today, 'powertrain')` (`lib/warranty.ts`,
unchanged, pre-existing) evaluates delivery date against a fixed 48-month
powertrain limit every time the page loads. There is no
`warranty_policies`/`warranty_claims` table - "Claims" on the Passport is
really "MQR records that happen to have a `warranty_status` recorded,"
which is a byproduct of the MQR workflow, not a first-class warranty
claim record (no claim number, no approval workflow, no reimbursement
tracking). A real Warranty module (already on the roadmap per
`docs/ROADMAP.md`'s "Next Development Phase" priority order) would own
this properly; this Passport reads what already exists rather than
inventing a stand-in table.

## Documents have no category field

`AttachmentService`/`attachments` table (ADR-010) stores `filename`/
`mimeType`/module/entity linkage - it has no "this is a Registration doc"
vs. "this is an Invoice" vs. "this is a Warranty doc" tag. The Passport's
Documents section approximates this with a MIME-type split (images vs.
everything else) purely as a display heuristic - it is not a real document
taxonomy, and should not be read as one by a future caller.

## Summary of genuine gaps (not fabricated, not silently dropped)

1. Manufacturing Year - no column.
2. Manufacturing Country - no column.
3. A true "Variant" field distinct from `sub_model` - no column.
4. Region - no column on `dealers`/`branches`/`vehicles`.
5. Owner History - no ownership-history table, no Customer entity.
6. A dedicated Warranty table (policies/claims) - status is computed, not stored.
7. A document category/taxonomy field on attachments - MIME type is a heuristic stand-in.

Every one of these renders honestly in the UI ("not tracked yet" / "not
available") rather than a fake or guessed value.

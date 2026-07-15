# Business Invariants (v3.1, ADR-036)

**Status: new document.** No equivalent existed before this pass -
`docs/governance/DATA_OWNERSHIP_MATRIX.md` and
`docs/architecture/MACHINE_DATA_OWNERSHIP.md` document *where a field's
value comes from today*; this document states the *business rule* that
value must obey, verified against current code, and flags every place
current code does not yet obey it. Where this document and
`PLATFORM_CONSTITUTION.md` overlap (Data Principles' "one Source of
Truth per domain"), this document is the concrete, field-level
instance of that principle for the tractor lifecycle - it does not
amend the Constitution, which has its own required amendment process
(Architecture Review + Governance Review + Explicit human approval,
`PLATFORM_CONSTITUTION.md`'s own Constitutional Amendments section) -
see the Roadmap in `BUSINESS_WORKFLOW_CONSOLIDATION_AUDIT.md` for that
recommendation, not performed here.

Every "Holds" / "VIOLATED" verdict below was checked directly against
current source, not assumed from documentation.

## Vehicle Identity = Serial Number

**Holds.** Every domain table (`ntr_records`, `pm_records`, `records`)
keys off `serial`; `vehicles.serial` is the natural key the Tractor IN
sync inserts/updates against
(`tractorInSyncService.ts`'s `knownSerials` set). No domain uses
`vehicles.id` as its own foreign identity outside internal FKs.

## Vehicle Master = `public.vehicles`

**Holds.** Confirmed independently in ADR-032's audit and re-confirmed
here; not re-derived.

## Warranty Identity = Vehicle

**Holds.** `calcWarranty(deliveryDate, foundDate, problemSystem)`
(`lib/warranty.ts`) takes no customer reference anywhere in its
signature or any of its 7 call sites. Warranty is unambiguously
Machine-keyed, matching this rule and ADR-035's own BR-2 finding
(restated, not re-derived).

## Warranty Start = Delivery Date

**Holds, mechanically** - `ntrPostCreateOrchestration.ts:42` writes
`vehicles.delivery_date` from the NTR record at registration time, and
`calcWarranty()` reads exactly that field. **At risk** - see "Delivery
Date becomes immutable after Warranty activation," below, which does
not hold today.

## Tractor IN (Factory Master) - field scope

**Stated rule**: ONLY Serial Number, Engine Number, Model, Product
Code, WH Arrival Date. NEVER Dealer, Delivery Date, Customer, Warranty,
Ownership.

**VIOLATED, confirmed in code.** `tractorInSyncService.ts` writes six
fields on every sync (both insert and update, per its own doc comment
at lines 204-208: *"Tractor IN is now the sole vehicle master...every
master field it carries is written on both insert and update"*):
`model`, `engine_number`, `product_code`, `wh_arrival_date`,
**`delivery_date`**, **`dealer_id`** (lines 230-237). Two of these -
`delivery_date` and `dealer_id` - are exactly the two fields this rule
says Tractor IN must never carry. This is not an accident: ADR-029
*deliberately* extended Tractor IN's sync scope to include `dealer_id`
("Reopens ADR-012 to extend Tractor IN sync to `product_code`/
`wh_arrival_date`/`model`/`engine_number`/`dealer_id` on both insert and
update," `docs/adr/README.md`). **This is a genuine conflict between an
already-Accepted architecture decision (ADR-029) and this milestone's
newly-stated business rule - not a bug to quietly patch.** Someone with
architecture authority must decide: reopen ADR-029's dealer-sync scope
(remove `dealer_id`/`delivery_date` from what Tractor IN writes), or
confirm the new rule as stated is wrong and Tractor IN's current
broader scope is intentional. See the audit's Write Precedence Matrix
and Roadmap for detail - not resolved by this document.

## Latest Approved NTR - field scope

**Stated rule**: ONLY Dealer, Delivery Date, Customer.

**Partially holds, one open question.** NTR is confirmed as the
correct writer of `delivery_date` (`ntrPostCreateOrchestration.ts`).
NTR does **not** write `vehicles.dealer_id` at all today -
`updateVehicleDeliveryInfo()` (`lib/db.ts:221-227`) writes only
`delivery_date`/`product_family_id`; `dealer_id` is never touched by
any NTR code path. Combined with the finding above, **`vehicles.
dealer_id` is written exclusively by Tractor IN today, never by NTR** -
the opposite of what both stated rules require. **Open question, not
resolved here**: `ntr_records` has no "Approved" status at all -
`record_status` is only `'Active' | 'Deleted'` (a soft-delete flag, not
an approval workflow state machine). "Latest Approved NTR" as a
concept presupposes an approval gate that does not exist in the current
schema. Business must clarify whether "Approved" means "the latest
`Active` (non-deleted) NTR record" (in which case the concept already
exists under a different name) or a genuinely new approval workflow is
wanted (a real, unscoped gap) - not assumed either way here.

## Warranty Start / Delivery Date immutability

**Stated rule**: Delivery Date becomes immutable after Warranty
activation. Document Submission Date must never affect Warranty.

**VIOLATED.** Since Tractor IN sync unconditionally re-writes
`delivery_date` on every run whenever the sheet's own date column is
non-blank (`tractorInSyncService.ts` line ~250:
`if (value) updatePayload[key] = value;`, no check for "already set by
an NTR registration"), `delivery_date` is not immutable at any point
today - a later sync can silently change it after warranty has already
been computed against the earlier value. This is the same
previously-identified risk as ADR-035's Finding BR-1, now stated as a
formal, named invariant violation rather than a risk to watch.
"Document Submission Date never affects Warranty" independently
**holds** - no code path passes a submission/created-at timestamp into
`calcWarranty()` anywhere; only `deliveryDate`/`foundDate` are used.

## Factory Data never overwrites Operational Data / Operational Data may extend Factory Data

**VIOLATED for `dealer_id`**, by the same mechanism as the Tractor-IN
field-scope finding above - Tractor IN (Factory Data) can overwrite
`dealer_id` on every sync regardless of whether NTR (Operational Data)
has already recorded a real dealer relationship for that unit. **Holds
for `delivery_date` only in the sense that NTR writes after Tractor
IN's insert-time value** - but per the immutability finding above, a
*later* Tractor IN sync can still overwrite NTR's Operational value
afterward, which is the same underlying defect stated two ways.

## Service History / Quality History never overwrite Operational Data

**Holds.** `pm_records`/`records` (MQR) each carry their own
`customer_name`/`customer_phone`/`dealer_id`/`branch_id` snapshot,
captured at creation time; neither writes back into `vehicles` or
`ntr_records`. No code path was found where a PM or MQR write mutates
Operational Data (NTR) or Factory Data (Tractor IN sync) - confirmed by
grepping every writer of `ntr_records`/`vehicles.dealer_id`/`vehicles.
delivery_date` (only `tractorInSyncService.ts` and
`ntrPostCreateOrchestration.ts` write either).

## PM: Factory Data vs. Operational Data

**Stated rule**: Factory Data ← Vehicle Master. Operational Data ←
Latest Approved NTR. Dealer and Delivery Date must never come from
Tractor IN.

**VIOLATED, transitively.** PM records source `dealer_id`/`branch_id`
at creation time from `PmVehicleSearchResult` (`searchVehiclesForPm()`,
`lib/db.ts`), which reads `vehicles.dealer_id`/`branch_id` directly -
and per the finding above, `vehicles.dealer_id` is itself Tractor-IN-
sourced, never NTR-sourced, today. PM's dealer therefore currently
comes from Tractor IN by inheritance, not because PM's own code reads
Tractor IN directly - the violation's root cause is the
`vehicles.dealer_id` write-source finding above, not a separate PM
defect. Fixing the root cause (Tractor IN scope) fixes this
transitively; no PM-specific code change is implied.

## MQR: NTR auto-fill

**Stated rule**: If an Approved NTR exists, auto-fill Dealer/Delivery
Date/Customer; otherwise allow manual Dealer selection, Customer/
Delivery Date optional. Support Customer Machine/Dealer Stock/MSEAL
Stock/Demo Machine.

**Not implemented - a gap, not a violation** (no existing rule is being
broken; the capability simply does not exist yet).
`src/app/api/records/route.ts` sources `dealer_id` purely from
`resolveDealerScope(session, body.dealerId)` - the current user's
session dealer, or a manual selection for roles that see all dealers -
with no NTR lookup at all. `customer_name`/`customer_phone` are
free-typed fields with no NTR cross-reference.
`vehicles.delivery_date` is read only to compute warranty status at
report time, never copied onto the MQR record itself. **No machine-
type/status classification field** (Customer Machine / Dealer Stock /
MSEAL Stock / Demo Machine) exists anywhere in the schema today -
confirmed via a repo-wide grep for `machine_type`/`vehicle_type`/`Demo`.
Both the auto-fill behavior and the machine-classification field are
real, unscoped future work - named in the Roadmap, not built here
("No new features" is this milestone's own explicit constraint).

## Verification

Every "Holds"/"VIOLATED"/"Not implemented" verdict above traces to a
specific file and line, re-checked directly in this pass:
`tractorInSyncService.ts`, `ntrPostCreateOrchestration.ts`,
`lib/db.ts`'s `updateVehicleDeliveryInfo()`/`searchVehiclesForPm()`,
`api/records/route.ts`, `ntr_records`'s `record_status` field
definition, and a repo-wide grep confirming no machine-type
classification field exists. `docs/adr/ADR-012-Tractor-IN-Master-Data.md`
and `docs/adr/README.md`'s ADR-029 entry, confirming the `dealer_id`
sync-scope expansion was a deliberate, Accepted decision, not an
accidental regression.

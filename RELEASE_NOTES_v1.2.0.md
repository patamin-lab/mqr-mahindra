# Release Notes — v1.2.0: MASP Platform Foundation v1.2.0

**Status: RELEASED.** Tagged and published as GitHub Release `v1.2.0` on
the merge commit `6b7afb67765610337c04d10857a2c8028efdaa4c` (PR #14,
2026-07-08), which sits on top of the Enterprise UI/UX Standardization
work below (merged earlier via PR #12, merge commit `08b4856`). `v1.2.0`
is the current baseline - see `PROJECT_STATE.md`'s "MASP Platform Layer"
entry for the full merge/tag/release/production verification record.

This release bundles two milestones onto the same version number:
Enterprise UI/UX Standardization (below) and the MASP Platform Layer
(Address/Lookup/Configuration/Reference Data Platforms, unified behind
`MasterDataService`) that completed the platform work before Workflow
Engine development begins.

Companion documents: `CHANGELOG_UI_STANDARDIZATION.md` (detailed
feature-by-feature summary), `docs/UI_STANDARD.md` (current-state
component/token inventory), `docs/architecture/PLATFORM_CONSTITUTION.md`
(the Master Data rules the Platform Layer added).

## Major changes

- **One shared Platform Header** on every authenticated page, replacing
  the floating language-toggle button and Sidebar's duplicate mobile top
  bar/logout button.
- **NTR Historical Import template v1.2**: required-field list expanded
  (Model/Retail Date/Hour Meter/Customer Title-First-Last/Address/
  Province/District/Sub-District), Engine Number now optional, new PDI
  Number field (2 DB migrations).
- **Attachment Standard**: one shared `AttachmentPhotoTile` fixes a real
  photo-cropping bug in PM's old tiles; NTR/PM required-attachment lists
  narrowed per the new standard.
- **Shared UI Library** consolidation: EmptyState/LoadingState now
  actually wired into 3 more tables, KpiCard extracted, NotificationBell
  extracted, semantic design tokens added.

## Real bugs found and fixed during this release

- PM's old attachment tiles used `object-cover`/fixed height, cropping
  portrait photos - now `object-contain`, never crops.
- Server-side create schemas for NTR/PM still required photos that the
  new Attachment Standard made optional, rejecting legitimate
  submissions with a 400 - caught during full-platform regression
  testing, fixed same day.

## Breaking changes

None to existing data or APIs beyond the NTR Historical Import template
version bump (v1.1 → v1.2) - a file built against the v1.2 template's
new required columns will fail validation on a v1.1-only file missing
them; this is the intended, documented behavior change (see
`docs/standards/NTR_IMPORT_MANUAL.md`).

## Upgrade notes

No destructive migration - `ntr_records.pdi_number` is additive and
nullable. `CustomerTractorPhoto` is no longer offered on new NTR
registrations, but existing records/data are untouched.

## MASP Platform Layer (merged after the above, same release)

- **Address Platform**: Thai Province/District/Sub-District/Postal Code
  lookup and validation, promoted from NTR-only code into a shared
  platform service. A new shared `AddressSelector` component (cascading
  dropdowns, backed by `/api/address/*` so the address master data is
  never bundled client-side) replaced NTR's 4 free-text address fields.
- **Lookup Platform**: Customer Type, Customer Title, Attachment Type,
  Severity/Priority, and MQR Status - one canonical source for every
  controlled vocabulary in the system.
- **Configuration Platform**: env-overridable business-rule constants
  (`getWarrantyLimitMonths()`), now with a real consumer (NTR's
  warranty-status filter).
- **Reference Data Platform**: a thin facade over `lib/db.ts`'s dealer/
  branch/technician/product-family reads - every business-module call
  site now goes through `MasterDataService` instead of importing
  `lib/db` directly.
- All four unified behind one `MasterDataService` facade
  (`src/shared/master-data/`), mirroring the existing `AttachmentService`
  shape.

## Repository housekeeping (same release)

Every fully-merged branch was deleted, including `sprint11` - a branch
of exploratory PM-record work that predated (and was fully superseded
by) the `features/maintenance/` module now live in `main`. Confirmed via
`git ls-tree` that its `features/pm-record/` (singular) module has zero
presence in `main` before deletion; no unique work was lost.

# Release Notes — v1.2.0 (candidate): Enterprise UI/UX Standardization

**Not yet tagged/released** - prepared alongside the code so
documentation isn't inconsistent with what shipped in PR #12, per this
repo's Post-v1.1.0 Development Standard. Whether this becomes `v1.2.0`
or folds into a differently-numbered release is a release-management
decision for whoever merges this PR - see the PR's own Merge Gate
Evaluation section for the current recommendation.

Companion documents: `CHANGELOG_UI_STANDARDIZATION.md` (detailed
feature-by-feature summary), `docs/UI_STANDARD.md` (current-state
component/token inventory).

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

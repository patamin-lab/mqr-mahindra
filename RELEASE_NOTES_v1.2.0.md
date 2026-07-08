# Release Notes — v1.2.0 (candidate): Enterprise UI/UX Standardization

**Status: merged to `main`** via PR #12 (merge commit `08b4856`,
2026-07-08) - not yet tagged. Whether this specific commit becomes the
`v1.2.0` tag/GitHub Release or folds into a later-numbered release is a
separate, explicit tagging decision not made as part of this merge (see
`.claude/rules/git.md` - tags/releases require their own explicit
instruction). All code, verification, and regression-testing described
below already happened before the merge, live on a Vercel Preview; the
merge itself was verified end-to-end on `main` and production
afterward - see `PROJECT_STATE.md`'s "Enterprise UI/UX Standardization -
Release Closeout" entry for the merge/production verification record.

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

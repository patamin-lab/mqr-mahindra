# Changelog — Enterprise UI/UX Standardization

**Status: COMPLETE - merged to `main`** via PR #12, merge commit
`08b4856` (2026-07-08). CI on `main` green, production deployment
verified healthy post-merge, no regression found. Released as part of
`v1.2.0` (tagged on merge commit `6b7afb6`, once the MASP Platform Layer
milestone below it completed) - see `RELEASE_NOTES_v1.2.0.md`.

Human-readable summary of the UI/UX standardization pass that shipped on
top of MASP Platform Foundation v1.1.0. See `docs/UI_STANDARD.md` for the
full current-state component/token inventory.

## Platform Header

One shared, sticky, responsive header (`PlatformHeader` + `AppShell`) on
every authenticated page: logo/module-title/breadcrumb on the left,
language selector/notification placeholder/user+role+dealer+branch/
user-menu-with-logout on the right. Replaces `Sidebar`'s own hand-rolled
mobile top bar and duplicate logout button.

## Language

The floating, `position: fixed` language-toggle button is gone. Its
logic split into `GoogleTranslateBridge` (invisible, mount-once legacy
fallback bootstrap) and `LanguageSelector` (the visible, embeddable
dropdown, no fixed positioning) - one implementation, embedded in the
header and on the login page. Persistence (the `app_locale` cookie) is
unchanged.

## Navigation

Nav item definitions extracted to a shared `navConfig.ts` - the single
source `Sidebar`'s active-route highlighting and `PlatformHeader`'s
breadcrumb lookup both read from, instead of two independently
maintained lists.

## NTR Historical Import (template v1.2)

Required: Model, Retail Date, Hour Meter, Customer Title/First/Last
Name, Address, Province, District, Sub-District (all moved from
optional). Optional: Engine Number (moved from required). New field:
PDI Number (`ntr_records.pdi_number`, two DB migrations - the column and
the `commit_ntr_legacy_import_row()` SECURITY DEFINER RPC). A real
import was run live end-to-end (preview → commit → verified row →
confirmed a missing-required-field row is rejected) as part of
verification.

## Attachment Standard

One shared `AttachmentPhotoTile` (16:9, `object-contain`, never crop) -
fixes a real bug where PM's two independent tile implementations used
`object-cover`/fixed height (cropped portrait photos). NTR required list
narrowed to ID Card/Tractor Name Plate/Delivery Report (Hour Meter Photo
demoted to optional, Customer with Tractor Photo removed from the create
form). PM required list narrowed to Service Report only (Meter/Nameplate
Photos demoted to optional). A real regression was found and fixed
during verification: the server-side create schemas still required the
now-optional photos, rejecting legitimate submissions with a 400 - both
`NtrRecordCreateBody` and `MaintenanceRecordCreateBody` now match the
client-side requirement list.

## Shared UI Library / Design Tokens

- Wired the previously-built-but-unused `EmptyState`/`LoadingState`
  components into the MQR records list, NTR registry list, and PM
  History Center tables; upgraded `LoadingState` from plain text into a
  real animated skeleton.
- Extracted `KpiCard` out of `dashboard/page.tsx` (previously local,
  unexported) into `components/shared/dashboard/`.
- Extracted `NotificationBell` out of `PlatformHeader` into its own
  reusable component.
- Added semantic `status.*` color tokens and `card`/`control` radius
  aliases to `tailwind.config.ts` - purely additive, no existing
  className changed.
- `TextField`/`SelectField` gained a `required` prop (consistent
  asterisk indicator) and `SelectField` gained a `disabled` prop
  (previously silently unsupported, confirmed unused by any caller).

## Repository cleanup

Removed confirmed-dead unused imports/consts found via
`tsc --noUnusedLocals --noUnusedParameters` (`Legend`, `ReactNode`,
`PHOTO_CATEGORIES`, `swalUpdateLoading`, `PDF_BRAND_RED`, `EMPTY_GPS`,
`PHOTO_FIELD`). Confirmed via sweep: no floating language button
remnants, no duplicate upload-tile implementations, no stale NTR import
template version references, PDF shared styles already consolidated in
a prior sprint (verified, not redone).

## Accessibility

Added a `:focus-visible` keyboard-focus ring for buttons/links/menu
items (previously only form inputs had one).

## Verification

lint/typecheck/453 tests/build/architecture all pass on every commit in
this initiative. Live Preview UAT: full page-load sweep across
SuperAdmin/DealerAdmin/DealerUser and every module, real NTR/PM create
calls confirming the attachment-schema regression fix, language cookie
persistence, single-header confirmation. Not independently verifiable in
this environment: real screenshots, physical tablet/mobile device
testing, screen-reader testing, precise contrast-ratio measurement - see
`docs/UI_STANDARD.md`'s Accessibility section.

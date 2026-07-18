# Image Platform Adoption Report

Status: PR #79E — PM migration

Architecture baseline: ADR-039, locked.

## Shared platform

The shared image foundation owns presentation state and resource coordination:

- `ImageItem` is the module-to-platform contract.
- `ImageThumbnail`, `ImagePreview`, and `ImageViewer` own thumbnail, preview,
  fullscreen, zoom, pan, rotate, and reset behavior.
- `AttachmentResourceProvider` owns cached signed-resource loading, expiry
  state, and bounded retry.
- `/api/attachments/[id]` and the Attachment Platform remain the only
  authorization and signed-URL boundary.
- PDF renderers consume the same image identity contract, but retain their
  existing server-side URL refresh and layout.

## Consumers

| Consumer | Status | Shared platform surface |
| --- | --- | --- |
| MQR | Migrated | Gallery, form thumbnails, timeline/photo presentation |
| NTR | Migrated | Gallery, form thumbnails, timeline/photo presentation |
| PM | Migrated in PR #79E | Detail gallery, create/edit thumbnails, PDF image identity |
| Delivery/PDI | Remaining | Legacy `AttachmentViewer` |
| Vehicle360 / Machine Passport | Remaining | Legacy `AttachmentViewer` through `MachineDocumentsPanel` |
| Knowledge attachments | Remaining compatibility consumer | Legacy `AttachmentViewer` |

## Adoption estimate

The current direct image consumer inventory contains five primary groups:
MQR, NTR, PM, Delivery/PDI, and Vehicle360/Machine Passport. Three are now
migrated. Estimated platform adoption is therefore **60% (3/5)**.

PM architecture compliance is **100% for the approved migration scope**:
all PM image presentation uses `ImageItem` and shared viewer/thumbnail/state
surfaces; PM retains only its domain adapter and existing PDF boundary.

The percentage excludes Knowledge because it is a general attachment viewer,
not one of the primary image-module migration targets. Including it as a
sixth consumer group would produce 50%; the underlying inventory is unchanged.

## Remaining duplicate components and deprecation report

No component is removed by PR #79E.

| Component or pattern | Classification | Reason |
| --- | --- | --- |
| `src/components/shared/attachments/AttachmentGallery.tsx` | Candidate for Removal | No PM/MQR/NTR consumer remains. Remove only after remaining legacy consumers and references are audited. |
| Legacy thumbnail markup inside `AttachmentGallery.tsx` | Candidate for Removal | Direct `<img>` grid behavior is no longer used by migrated consumers; it disappears with the legacy gallery. |
| `src/components/shared/attachments/AttachmentViewer.tsx` | Compatibility Layer | Still used by Delivery/PDI, Knowledge, and Vehicle360/Machine Passport. Preserve until those consumers migrate. |
| Legacy `ImagePreview` exported by `AttachmentViewer.tsx` | Compatibility Layer | Retained for the legacy viewer until its remaining consumers move to `ImagePreview`/`ImageViewer`. |
| `AttachmentPhotoTile.tsx` | Still Required | Shared upload-slot shell used by PM and NTR. Its optional `ImageItem` path is the compatibility bridge for upload forms. |
| Page-level URL resolution in Delivery/PDI, Knowledge, and Machine Passport | Compatibility Layer | Legacy consumers still receive resolved URL records. Replace during their migration, not in PM scope. |
| `resolvePdfAttachmentUrl` and PDF-side signed URL refresh | Still Required | Server-side PDF rendering needs a fresh resource and must preserve legacy URL fallback. |
| Legacy preview/transform/loading/retry logic inside `AttachmentViewer.tsx` | Compatibility Layer | Behavior is still required by remaining consumers; shared-platform parity is verified before removal. |
| PM page-level signed URL resolution | Safe to Remove | Removed from PM detail. PM now refreshes attachment resources through the shared provider. |
| PM duplicate lightbox/grid (`AttachmentGallery` usage) | Safe to Remove | Removed from PM detail. `MaintenanceImageGallery` uses the shared viewer. |

## PM flow adoption

| PM flow | Old presentation | Shared presentation |
| --- | --- | --- |
| Create/upload | `AttachmentPhotoTile` URL fallback | `AttachmentPhotoTile` + PM `ImageItem` adapter + `ImageThumbnail` |
| Edit/upload | `AttachmentPhotoTile` URL fallback | `AttachmentPhotoTile` + provider refresh + `ImageThumbnail` |
| Detail/gallery/lightbox | `AttachmentGallery` with direct `<img>` | `MaintenanceImageGallery` + `ImageThumbnail` + `ImageViewer` |
| Preview/transforms | `AttachmentGallery`/legacy `ImagePreview` | Shared `ImagePreview` and transform state |
| PDF | PM URL list plus PDF resolver | Shared `ImageItem` identity plus existing PDF resolver/layout |
| History | No image rendering in rows; list PDF has no photo section | Unchanged; no image migration required |

## Removal gate

Safe deletion begins only after Delivery/PDI and Vehicle360/Machine Passport
are migrated, Knowledge compatibility use is explicitly retired, and the
full architecture/typecheck/lint/test/build suite passes. Crop persistence,
editing, storage changes, API changes, and business-rule changes remain out
of scope.

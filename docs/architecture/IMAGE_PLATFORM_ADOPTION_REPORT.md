# Image Platform Adoption Report

Status: PR #79I — Knowledge migration

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
| Delivery/PDI | Migrated in PR #79G | PDI evidence adapter, shared thumbnails/viewer/provider; Delivery detail has no image renderer |
| Vehicle360 / Machine Passport | Migrated in PR #79H | Machine documents adapter, shared thumbnails/viewer/provider; ActivityTimeline photo diffs use shared thumbnails |
| Knowledge attachments | Migrated in PR #79I | Case-document adapter, shared thumbnails/viewer/provider; ActivityTimeline photo diffs use shared thumbnails |

## Adoption estimate

The current direct image consumer inventory contains six tracked groups:
MQR, NTR, PM, Delivery/PDI, Vehicle360/Machine Passport, and Knowledge. All
six are now migrated. Estimated platform adoption is therefore **100% (6/6)**.

Knowledge architecture compliance is **100% for the approved migration
scope**: case documents use `ImageItem`, shared viewer/thumbnail/transform
state, and the shared resource provider; historical timeline photo diffs use
the shared thumbnail path. Authorization remains outside presentation
components.

All tracked image consumers now use the locked presentation platform. PDF
behavior remains unchanged; no Knowledge PDF renderer exists in this
repository.

## Remaining duplicate components and deprecation report

No component is removed by PR #79I.

| Component or pattern | Classification | Reason |
| --- | --- | --- |
| `src/components/shared/attachments/AttachmentGallery.tsx` | Candidate for Removal | No PM/MQR/NTR consumer remains. Remove only after remaining legacy consumers and references are audited. |
| Legacy thumbnail markup inside `AttachmentGallery.tsx` | Candidate for Removal | Direct `<img>` grid behavior is no longer used by migrated consumers; it disappears with the legacy gallery. |
| `src/components/shared/attachments/AttachmentViewer.tsx` | Candidate for Removal | No active consumer remains after Knowledge migration; remove after final repository-reference audit. |
| Legacy `ImagePreview` exported by `AttachmentViewer.tsx` | Candidate for Removal | No active consumer remains; shared `ImagePreview` now serves all migrated consumers. |
| `AttachmentPhotoTile.tsx` | Still Required | Shared upload-slot shell used by PM and NTR. Its optional `ImageItem` path is the compatibility bridge for upload forms. |
| Page-level URL resolution in Knowledge | Safe to Remove | Knowledge now maps attachment identity and lets shared provider resolve display resources. |
| `resolvePdfAttachmentUrl` and PDF-side signed URL refresh | Still Required | Server-side PDF rendering needs a fresh resource and must preserve legacy URL fallback. |
| Legacy preview/transform/loading/retry logic inside `AttachmentViewer.tsx` | Candidate for Removal | No active consumer remains; shared-platform parity is verified. |
| PM page-level signed URL resolution | Safe to Remove | Removed from PM detail. PM now refreshes attachment resources through the shared provider. |
| PM duplicate lightbox/grid (`AttachmentGallery` usage) | Safe to Remove | Removed from PM detail. `MaintenanceImageGallery` uses the shared viewer. |
| PDI page-level `AttachmentService.getUrl()` orchestration | Safe to Remove | PDI now maps attachment identity and lets the shared resource provider resolve display resources. |
| PDI `AttachmentViewer` usage | Safe to Remove | Replaced by `InspectionEvidenceGallery` using shared image primitives and compatibility links for non-images. |
| Machine Passport `AttachmentViewer` usage | Safe to Remove | Replaced by `MachineDocumentsGallery` using shared image primitives and compatibility links for non-images. |
| Machine Passport page-level `AttachmentService.getUrl()` orchestration | Safe to Remove | Machine documents now pass attachment identity to the shared resource provider. |
| Knowledge `AttachmentViewer` usage | Safe to Remove | Replaced by `KnowledgeDocumentsGallery` using shared image primitives and compatibility links for non-images. |

## Delivery/PDI flow adoption

| Flow | Old presentation | Shared presentation |
| --- | --- | --- |
| Delivery create/detail/evidence | No image renderer in current repository | No migration required; existing stage/link/detail behavior unchanged |
| PDI inspection/evidence/attachments | `AttachmentViewer` plus page-level `AttachmentService.getUrl()` | `InspectionEvidenceGallery` + `ImageItem` adapter + shared provider/viewer/thumbnail |
| PDI history/timeline | `ActivityTimeline`; no image renderer in timeline rows | Unchanged timeline; evidence remains in detail section |
| Mixed evidence | Legacy viewer handled image/document cards | Shared image viewer for images; provider-backed open/download links for non-images |

## PM flow adoption

| PM flow | Old presentation | Shared presentation |
| --- | --- | --- |
| Create/upload | `AttachmentPhotoTile` URL fallback | `AttachmentPhotoTile` + PM `ImageItem` adapter + `ImageThumbnail` |
| Edit/upload | `AttachmentPhotoTile` URL fallback | `AttachmentPhotoTile` + provider refresh + `ImageThumbnail` |
| Detail/gallery/lightbox | `AttachmentGallery` with direct `<img>` | `MaintenanceImageGallery` + `ImageThumbnail` + `ImageViewer` |
| Preview/transforms | `AttachmentGallery`/legacy `ImagePreview` | Shared `ImagePreview` and transform state |
| PDF | PM URL list plus PDF resolver | Shared `ImageItem` identity plus existing PDF resolver/layout |
| History | No image rendering in rows; list PDF has no photo section | Unchanged; no image migration required |

## Vehicle360 / Machine Passport flow adoption

| Flow | Old presentation | Shared presentation |
| --- | --- | --- |
| Machine Passport documents/photos | `AttachmentViewer` plus page-level signed URL resolution | `MachineDocumentsGallery` + `ImageItem` + shared provider/thumbnail/viewer |
| Historical attachments/mixed records | Legacy viewer split image/document records | Shared image viewer for images; provider-backed open/download links for non-images |
| Vehicle timeline | Existing lifecycle `TimelineItem` rows | Unchanged milestone rows; no image renderer exists in lifecycle feed |
| Activity/history photo diffs | Direct `<img>` fallback | Shared `ImageThumbnail` with legacy URL presentation contract |

## Knowledge flow adoption

| Flow | Old presentation | Shared presentation |
| --- | --- | --- |
| Case/article attachments | `AttachmentViewer` plus page-level signed URL resolution | `KnowledgeDocumentsGallery` + `ImageItem` + shared provider/thumbnail/viewer |
| Photo previews/transforms | Legacy `AttachmentViewer` preview | Shared `ImagePreview` and transform state |
| Historical activity photo diffs | Direct `<img>` fallback | Shared `ImageThumbnail` with legacy URL presentation contract |
| Mixed attachments | Legacy image/document viewer | Shared image viewer for images; provider-backed open/download links for non-images |

## Removal gate

Safe deletion begins after final repository-reference audit confirms no
legacy viewer consumers, and the
full architecture/typecheck/lint/test/build suite passes. Crop persistence,
editing, storage changes, API changes, and business-rule changes remain out
of scope.

# PR #79J — Final Shared Image Platform Repository Audit

Status: Audit complete; dead legacy components removed in PR #79K.

Baseline: dd39bbc feat: migrate Knowledge to shared image platform

Architecture: ADR-039, locked.

## 1. Platform Adoption Report

| Consumer | Status | Shared surface |
| --- | --- | --- |
| MQR | Migrated | ImageItem, shared gallery/viewer/provider, timeline photos |
| NTR | Migrated | ImageItem, shared gallery/viewer/provider, upload previews |
| PM | Migrated | ImageItem, shared gallery/viewer/provider, PDF identity |
| Delivery/PDI | Migrated | PDI evidence gallery/provider; Delivery has no image renderer |
| Vehicle360/Machine Passport | Migrated | Machine documents/provider; activity photo thumbnails |
| Knowledge | Migrated | Case documents/provider; activity photo thumbnails |

Adoption: **100% (6/6 tracked consumers)**.

Active legacy consumers: **none found**.

## 2. Repository Audit

Search covered src, scripts, and docs, excluding generated output and
dependencies. Runtime import searches found no active imports of
AttachmentViewer or AttachmentGallery.

| Finding | Classification | Evidence |
| --- | --- | --- |
| src/components/shared/attachments/AttachmentViewer.tsx | Removed | Dead definition with no active production import; removed in PR #79K |
| AttachmentViewerItem and legacy ImagePreview export | Removed | Reachable only from dead viewer code; removed in PR #79K |
| src/components/shared/attachments/AttachmentGallery.tsx | Removed | Dead definition with no active production import; removed in PR #79K |
| resolveNtrAttachmentUrls | Dead Code / Safe To Remove | No implementation/import; stale historical report reference only |
| resolvePdfAttachmentUrl | Required | Server-side PDF boundary used by MQR, NTR, PM |
| AttachmentService.getUrl() | Required boundary | API routes and PDF services only |
| StorageProvider implementations | Required boundary | Shared Attachment Platform only |
| PhotoDiff direct img branch | Compatibility | Used only when generic timeline caller omits useImagePlatform |
| AttachmentPhotoTile direct img fallback | Compatibility | Legacy URL-only upload-preview path |
| Print/PDF img markup | Required exception | Static QR, print, or server document rendering |
| Shared ImageThumbnail/ImagePreview img markup | Required | Platform primitives own rendering |

## 3. Dead Code Report

### Removed in PR #79K

- AttachmentViewer.tsx
- AttachmentViewerItem
- AttachmentViewer.ImagePreview
- AttachmentGallery.tsx
- AttachmentGalleryItem
- AttachmentGalleryProps
- stale resolveNtrAttachmentUrls documentation references

### Compatibility or required

- AttachmentPhotoTile URL fallback: required for legacy upload records.
- PhotoDiff fallback branch: generic compatibility for callers not yet opting
  into shared thumbnail rendering.
- resolvePdfAttachmentUrl: required server-side URL refresh.
- AttachmentService.getUrl: required API/PDF boundary.

### Unused hooks/adapters/exports

No unused shared image hooks found. No useAttachmentResource hook exists.
All module resource providers and ImageItem mappers have active consumers.
No legacy viewer/gallery exports remain.

## 4. Legacy Removal Candidates

| Candidate | Status | Blocker |
| --- | --- | --- |
| AttachmentGallery.tsx | Removed | Final external/import reference audit passed |
| AttachmentViewer.tsx | Removed | Final external/import reference audit passed |
| Legacy viewer item/preview exports | Removed | Removed with viewer |
| resolveNtrAttachmentUrls references | Safe To Remove | Documentation cleanup only |
| PhotoDiff fallback branch | Compatibility | Remove only after all timeline callers explicitly opt in |
| AttachmentPhotoTile URL fallback | Compatibility | Remove only after legacy upload URL support retires |

No candidate requires DB, API, storage, authorization, or business-rule work.

## 5. Architecture Compliance Report

| Rule | Result | Evidence |
| --- | --- | --- |
| Modules use ImageItem adapters | PASS | All six tracked consumers have active mappers/adapters |
| Shared viewer/thumbnail/preview ownership | PASS | Feature modules compose shared primitives |
| Shared retry/loading/transform ownership | PASS | InMemoryAttachmentResourceProvider, ImagePreview, transform reducer |
| Feature modules do not refresh signed URLs directly | PASS | No feature/page getUrl() calls found |
| Storage access remains centralized | PASS | No module/component storage-provider access found |
| Authorization remains outside presentation | PASS | Existing Attachment API and service boundaries unchanged |
| PDF boundary preserved | PASS | PDF services retain resolvePdfAttachmentUrl |
| Architecture enforcement script | PASS | 6 rules pass, 0 warnings, 0 failures |

## 6. Regression Risk Assessment

| Risk | Level | Assessment |
| --- | --- | --- |
| Hidden external import after removal | Low | Repository import search, typecheck, and build passed |
| Legacy URL fallback removal | High | Keep AttachmentPhotoTile fallback until records are migrated |
| Signed URL expiry | Low | Shared provider owns expiry margin, refresh, retry, and cache |
| PDF regression | Low | PDF resolver and layout remain unchanged |
| Mixed attachments | Low | Image records use viewer; non-images retain provider-backed links |
| Timeline history rendering | Low | Shared thumbnail path active; fallback remains for generic callers |
| Browser/mobile behavior | Low | Existing shared primitives and controls unchanged |
| Documentation drift | Low | Only historical audit/release documents retain original wording |

## 7. Recommended Removal Order

1. Keep active standards aligned with ADR-039.
2. Keep PhotoDiff fallback until every timeline caller opts into
   useImagePlatform.
3. Remove AttachmentPhotoTile URL fallback only after legacy upload records
   are retired.

PR #79K completed the safe removal. PhotoDiff and AttachmentPhotoTile remain
compatibility components and require separate evidence before any cleanup.

## Documentation Drift Findings

Historical documents still mention the legacy viewer in their original
release/blueprint context; they are not runtime references:

- docs/releases/STORAGE_PLATFORM_RELEASE.md

Historical ADR/release records may retain original wording if clearly marked
historical. Active standards must point new consumers to ADR-039 and the shared
image platform.

# PR #79F — Platform Cleanup & Architecture Enforcement (Historical)

Status: Historical assessment, superseded by PR #79K and the PR #79L v1
release. No production code was removed or changed by this report itself.
The pre-removal findings below are retained for audit traceability; they are
not the current repository state. Current status is recorded in
`FINAL_SHARED_IMAGE_PLATFORM_REPOSITORY_AUDIT.md`,
`IMAGE_PLATFORM_ADOPTION_REPORT.md`, and `SHARED_IMAGE_PLATFORM_V1.md`.

Architecture baseline: ADR-039, locked.

## 1. Repository scan

Scan scope: `src/`, `scripts/`, and architecture/governance documentation.
Search used `rg`; no framework behavior lookup was required.

### Image implementation inventory

| Area | Current locations | Assessment |
| --- | --- | --- |
| Shared thumbnail/preview/viewer | `src/components/shared/image/` | Required platform foundation. Active consumers: MQR, NTR, PM, MQR edit/form surfaces, activity photo platform path. |
| Legacy gallery | `src/components/shared/attachments/AttachmentGallery.tsx` | Removed in PR #79K after the zero-import audit. |
| Legacy viewer | `src/components/shared/attachments/AttachmentViewer.tsx` | Removed in PR #79K after Delivery/PDI, Knowledge, and Machine Passport migrated. |
| Upload tile | `src/components/shared/attachments/AttachmentPhotoTile.tsx` | Required by PM and NTR. Delegates preview rendering to `ImageThumbnail` when an `ImageItem` is supplied. |
| Image processing | `src/components/shared/attachments/imageProcessing.ts` | Active NTR upload dependency. Required until NTR upload policy is deliberately separated or generalized. |
| Resource providers | `MqrImageGallery`, `ntrAttachmentResourceProvider`, `maintenanceAttachmentResourceProvider` | Active module adapters. Same authorized attachment route and similar loader/cache orchestration duplicated across consumers. |
| PDF URL resolution | `src/lib/pdf/resolveAttachmentUrl.ts` plus MQR/NTR/PM PDF services | Required server-side boundary. Not dead code. |

### Legacy and direct-render patterns

- `AttachmentGallery` contains direct thumbnail `<img>` markup and an old
  lightbox state path. No active code import found.
- `AttachmentViewer` contains direct image/document rendering and its own
  preview transform state. Active compatibility consumer.
- `PhotoDiff` has a direct `<img>` fallback when `useImagePlatform=false`.
- `records/[jobId]/print-view.tsx` has direct `<img>` output for existing print
  layout. Treat as print-specific compatibility until print rendering is
  explicitly migrated.
- `object-cover` remains in legacy viewers, print output, and fallback photo
  diff paths. Shared platform thumbnail paths use `object-contain`; this is
  not a blanket violation until each legacy consumer is migrated.
- `resolveNtrAttachmentUrls` has no implementation. A stale reference remains
  in `src/app/(app)/records/[jobId]/edit/page.tsx` and should be removed from
  documentation/comments.

## 2. Architecture compliance

### Existing enforcement

`scripts/architecture-check.ts` currently passes its six rules:

- business modules do not import storage internals;
- business modules do not import raw SDKs;
- storage provider access stays inside its allowlist;
- concrete providers are factory-constructed;
- attachment platform has no circular dependency;
- CI invokes architecture check.

### Image architecture findings (historical, before PR #79K)

| Finding | Location | Classification |
| --- | --- | --- |
| PM edit page performs page-level signed URL refresh | `src/app/(app)/pm-records/[id]/edit/page.tsx:89` | Resolved by the shared provider consolidation before the v1 release. |
| MQR detail performs page-level signed URL refresh | `src/app/(app)/records/[jobId]/page.tsx:54` | Resolved by the shared provider consolidation before the v1 release. |
| MQR edit performs page-level signed URL refresh | `src/app/(app)/records/[jobId]/edit/page.tsx:36` | Resolved by the shared provider consolidation before the v1 release. |
| Delivery/PDI, Knowledge, and Machine Passport resolve URLs before legacy viewer rendering | Historical module paths | Resolved by PRs #79G, #79H, and #79I. |
| Legacy `AttachmentViewer` owns viewer/preview/transform/loading state | Removed component | Removed in PR #79K; shared platform parity is now the repository standard. |
| Legacy `PhotoDiff` can render direct `<img>` | `src/components/shared/activity-timeline/PhotoDiff.tsx` | Compatibility fallback. Default remains needed by non-adopted timeline consumers. |
| Direct storage provider access from business modules | Current architecture check | No violation found. |

### Compliance result

Platform/storage architecture: **PASS** under current checker.

Image architecture: **PASS**. The current checker and final repository audit
find no active legacy viewer/gallery consumers, feature-module URL refresh, or
direct storage-provider access. No storage access violation found.

## 3. Dead code report

### Confirmed unused or near-unused

| Item | Evidence | Status |
| --- | --- | --- |
| `AttachmentGallery` component | Zero production imports in the final audit | Removed in PR #79K |
| `AttachmentGalleryItem` and `AttachmentGalleryProps` | Reachable only through the removed component | Removed in PR #79K |
| `resolveNtrAttachmentUrls` symbol | No implementation/import; stale reference was cleaned up | Safe documentation cleanup completed |

### Active, not dead

| Item | Active users | Status |
| --- | --- | --- |
| `AttachmentViewer` | No active users after PR #79I | Removed in PR #79K |
| Legacy `AttachmentViewer.ImagePreview` | Reachable only through removed legacy components | Removed in PR #79K |
| `AttachmentPhotoTile` | PM, NTR | Required shared upload shell |
| `imageProcessing.ts` | NTR form | Required NTR upload behavior |
| MQR/NTR/PM image adapters | Detail, form, PDF consumers | Required module-to-platform mapping |
| Shared `ImagePreview`, `ImageThumbnail`, `ImageViewer`, transform reducer, resource provider | Shared platform consumers and tests | Required foundation |

Search cannot prove unused React hooks or exports that are dynamically
referenced. No additional unused hook was confirmed by repository search.

## 4. Deprecation report

| Item | Classification | Gate |
| --- | --- | --- |
| `AttachmentGallery.tsx` and its item/props exports | Safe To Remove | Removed in PR #79K after the zero-import audit. |
| Stale `resolveNtrAttachmentUrls` references | Safe To Remove | Documentation-only cleanup. |
| `AttachmentViewer.tsx` | Safe To Remove | Removed in PR #79K after all consumers migrated. |
| Legacy `ImagePreview` export in `AttachmentViewer.tsx` | Safe To Remove | Removed with the legacy viewer in PR #79K. |
| `PhotoDiff` direct `<img>` fallback | Compatibility Layer | All timeline consumers must opt into shared image platform. |
| PDI/Knowledge/Machine page-level URL resolution | Safe To Remove | Consumer migration and provider coverage completed. |
| PM edit page URL refresh | Safe To Remove | Shared provider ownership verified in the v1 audit. |
| MQR detail/edit URL refresh | Safe To Remove | Shared provider ownership verified in the v1 audit. |
| `AttachmentPhotoTile` | Required | PM and NTR upload flows depend on it. |
| `imageProcessing.ts` | Required | NTR upload contract depends on it. |
| `resolvePdfAttachmentUrl` | Required | PDF rendering needs fresh signed resources plus legacy fallback. |
| `uploadAttachment` and attachment API routes | Required | Shared upload/authorization boundary. |

## 5. CI enforcement proposal

Add `scripts/image-architecture-check.ts`, run from `npm run architecture` or
as a required adjacent CI step.

### Fail rules

1. No imports of `AttachmentGallery` from production code.
2. No imports of `AttachmentViewer` from migrated MQR, NTR, or PM paths.
3. No `AttachmentService.getUrl()` in migrated page files. Allow PDF services,
   attachment API routes, and explicit compatibility allowlist entries.
4. No `new AttachmentService()` in migrated page-level presentation paths.
5. No imports or construction of `StorageProvider`, concrete providers, or
   provider factory from business modules. Reuse current architecture rules.
6. No new `ImageViewer`, `ImagePreview`, thumbnail grid, transform reducer,
   resource cache, or retry state implementation outside shared image platform.
7. No new page-level signed URL resolution helper. Require
   `AttachmentResourceProvider` or an approved server-side PDF boundary.
8. No new direct `<img>` in module presentation code unless path is in an
   explicit print/PDF or compatibility allowlist.
9. No new `resolveNtrAttachmentUrls` or equivalent module-specific URL helper.

### Warning rules during migration

- `object-cover` in image presentation outside approved print/legacy paths.
- direct `<img>` inside `PhotoDiff` fallback.
- duplicate provider loader shapes across module adapters.
- stale references to removed components in architecture documentation.

### Checker design

Use current dependency-free source scanning style for import and forbidden
pattern rules. Add path-aware allowlists for legacy consumers. Add an import
graph check for dead component imports. Keep false positives visible in report;
do not silently suppress them.

## 6. Cleanup plan (completed)

No code action was authorized in PR #79F; the follow-up cleanup was completed
by PRs #79G through #79K.

1. Architecture checker and production allowlists are active.
2. URL refresh ownership is centralized in `AttachmentResourceProvider`.
3. Delivery/PDI, Knowledge, and Machine Passport use shared image adapters.
4. Legacy gallery/viewer code and stale exports were removed after the final
   zero-import audit.
5. Remaining direct-image fallbacks are documented print/PDF/timeline cases,
   not duplicate attachment viewers.

## 7. Estimated PR breakdown

| PR | Scope | Estimate |
| --- | --- | --- |
| 79F-1 | Add image architecture checker, path-aware allowlist, CI reporting | 1–2 days |
| 79F-2 | Remove PM edit and MQR page-level refresh paths; preserve fallback/PDF behavior | 1–2 days |
| 79F-3 | Delivery/PDI shared image adapter and viewer migration | 2–3 days |
| 79F-4 | Knowledge and Machine Passport shared image adapter/viewer migration | 2–3 days |
| 79F-5 | Timeline fallback removal and direct-image policy cleanup | 1–2 days |
| 79F-6 | Delete legacy gallery/viewer after zero-use verification; reconcile docs | 1–2 days |

Estimates exclude crop persistence, image editing, storage changes, API/schema
changes, and business-rule changes.

## Conclusion

Repository cleanup completed in PR #79K and platform governance finalized in
PR #79L. No legacy viewer/gallery consumer, feature-module URL refresh, or
direct storage-provider violation remains. This historical report is retained
only as the PR #79F audit record.

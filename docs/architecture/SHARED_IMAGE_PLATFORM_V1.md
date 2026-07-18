# Shared Image Platform v1

Status: Implemented, production-proven, and locked by ADR-039.

Release: PR #79L, 2026-07-18.

## Overview

Shared Image Platform v1 is the presentation layer for persisted and local
image resources. It standardizes image identity, thumbnails, previews,
fullscreen viewing, transforms, loading, errors, retry, signed-resource
refresh, and in-memory caching across platform consumers.

Attachment Platform remains separate and authoritative for attachment identity,
authorization, storage, retention, and signed-resource generation.

## Architecture

```text
Feature adapter
  -> ImageItem
  -> AttachmentResourceProvider
  -> ImageThumbnail / ImagePreview / ImageViewer
  -> browser rendering

AttachmentService / API
  -> authorization and attachment metadata
  -> signed-resource capability

PDF services
  -> shared attachment identity
  -> existing server-side URL resolver and PDF layout
```

Ownership:

- `ImageItem`: durable attachment identity plus presentation metadata.
- `AttachmentResourceProvider`: resource loading, expiry handling, retry,
  cache coordination, and legacy URL fallback contract.
- `ImageThumbnail`: list and grid presentation.
- `ImagePreview`: preview and transform presentation.
- `ImageViewer`: fullscreen viewer state and controls.
- `AttachmentService` and APIs: authorization, storage, and signed-resource
  boundary. Presentation components perform no authorization.
- Feature modules: domain mapping only. They do not own viewer, thumbnail,
  preview, transform, loading, retry, cache, storage, or URL refresh logic.

## Goals

- One presentation contract for all image consumers.
- Durable attachment IDs prioritized over transient URLs.
- Consistent object-contain rendering and temporary transforms.
- Safe signed-resource expiry and retry behavior.
- Backward compatibility for legacy URL-only and mixed attachment records.
- No crop persistence, storage redesign, API redesign, or business-rule change.

## Migration timeline

| Stage | Result |
| --- | --- |
| PR #79A | Architecture and design review approved |
| PR #79B | Shared foundation implemented |
| PR #79C | MQR migrated as reference consumer |
| PR #79D | Documentation refinement |
| PR #79E | PM migrated |
| PR #79F | Repository cleanup assessment and governance proposal |
| PR #79F follow-up | URL refresh centralized in AttachmentResourceProvider |
| PR #79G | Delivery/PDI migrated |
| PR #79H | Vehicle360/Machine Passport migrated |
| PR #79I | Knowledge migrated |
| PR #79J | Final repository audit |
| PR #79K | Dead legacy viewer/gallery removed |
| PR #79L | v1 release documentation and governance finalized |

## Final adoption

All six tracked consumer groups use shared image presentation:

- MQR
- NTR
- PM
- Delivery/PDI
- Vehicle360/Machine Passport
- Knowledge

Adoption: **100% (6/6)**.

No active `AttachmentViewer` or `AttachmentGallery` consumer remains.

## Removed legacy components

PR #79K removed:

- `src/components/shared/attachments/AttachmentViewer.tsx`
- `src/components/shared/attachments/AttachmentGallery.tsx`
- Legacy viewer item, preview, transform, loading, and retry implementations

Retained compatibility paths:

- `PhotoDiff` legacy URL fallback for generic timeline callers.
- `AttachmentPhotoTile` URL fallback for legacy upload records.
- PDF-side signed URL resolution and existing PDF layout.
- Attachment API and storage-provider boundaries.

## Platform rules

1. New image features must map domain data to `ImageItem`.
2. Browser image resources must load through `AttachmentResourceProvider`.
3. Use shared `ImageThumbnail`, `ImagePreview`, and `ImageViewer`.
4. Feature modules must not implement viewer, preview, transform, loading,
   retry, cache, storage, authorization, or signed URL refresh behavior.
5. Do not import or recreate `AttachmentViewer` or `AttachmentGallery`.
6. Do not access `StorageProvider` or concrete providers from UI/module code.
7. Do not refresh attachment URLs in app pages.
8. Keep PDF/server URL resolution within existing PDF boundaries.
9. Keep legacy URL and attachment-ID compatibility until separately retired.
10. Crop editing, persistence, metadata, and versioning require separate ADRs.

Architecture enforcement: `npm run architecture` Rules 1-7. Rule 7 checks
legacy component names, UI storage-provider references, page-level URL refresh,
and direct image markup in feature modules. Shared compatibility, PDF, print,
and platform primitive paths remain explicit exceptions.

## Developer onboarding

For any new image flow:

1. Read this document, ADR-039, and `docs/engineering/ARCHITECTURE_ENFORCEMENT.md`.
2. Identify durable attachment ID, MIME type, filename, label, and legacy URL
   fallback in the module's adapter.
3. Return `ImageItem[]`; do not return a custom viewer model.
4. Provide `AttachmentResourceProvider` with the approved attachment resource
   boundary.
5. Render with shared thumbnail, preview, or viewer components.
6. Keep authorization in the existing service/API scope checks.
7. Add compatibility, expiry, retry, and mixed-record tests where relevant.
8. Run Architecture, Typecheck, Lint, Tests, and Build before review.

## Best practices

- Use `attachmentId` as cache identity; treat URLs as transient resources.
- Keep signed URLs out of durable browser storage.
- Preserve `object-contain` unless a separately approved design changes it.
- Keep transforms temporary and resettable; never persist crop or transform
  state through viewer controls.
- Separate image rendering from non-image open/download behavior.
- Add module adapters beside module domain mapping, not inside shared viewer
  components.
- Reuse existing PDF resolver and layout; do not introduce a browser viewer
  into server-side PDF rendering.

## Known limitations

- `PhotoDiff` and `AttachmentPhotoTile` retain legacy URL fallbacks for
  compatibility.
- PDF rendering keeps server-side URL refresh because it runs outside the
  browser resource lifecycle.
- Crop editor and crop persistence are not part of v1.
- Image metadata, OCR, AI annotation, compression, and version history are
  future capabilities, not v1 behavior.
- Cache is in-memory and scoped to the active runtime; durable URL caching is
  intentionally unsupported.

## Future roadmap

Future capabilities require separate design and approval:

- Crop Editor
- Image Metadata
- AI Annotation
- OCR
- Image Compression
- Image Versioning

These extensions must preserve v1 ownership boundaries and add no storage,
schema, API, authorization, or business-rule changes without separate ADRs.

## Release verification

- Architecture: PASS, Rules 1-7.
- Typecheck: PASS.
- Lint: PASS with existing warnings only.
- Tests: PASS, 832 tests.
- Build: PASS with existing `libheif` dependency warning.

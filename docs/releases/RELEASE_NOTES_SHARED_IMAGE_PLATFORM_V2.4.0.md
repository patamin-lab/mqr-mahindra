# Release Notes — v2.4.0

## Shared Image Platform v1

Release status: **Released**

Release branch: `main`

Release tag: `v2.4.0` (`d65bee9`)

## Summary

v2.4.0 completes and governs Shared Image Platform v1 across the repository.
All six tracked consumer groups use one shared presentation contract while
Attachment Platform remains authoritative for identity, authorization,
storage, retention, and signed-resource generation.

## Highlights

- Shared `ImageItem` contract for image presentation identity.
- Central `AttachmentResourceProvider` for signed-resource loading, expiry,
  retry, cache coordination, and legacy URL fallback.
- Shared `ImageThumbnail`, `ImagePreview`, and `ImageViewer` primitives.
- Consistent loading, error, retry, zoom, pan, rotate, reset, and
  `object-contain` behavior.
- Legacy viewer/gallery code removed after repository-wide zero-use audit.
- Engineering governance finalized through `ENGINEERING_PLAYBOOK.md`,
  `AI_GUIDE.md`, and `DEVELOPMENT_STANDARD.md`.

## Architecture

ADR-039 is accepted, implemented, production-proven, and locked. Feature
modules map domain records to `ImageItem`; presentation resources load through
`AttachmentResourceProvider`; shared image primitives render them. Modules do
not own viewer state, transforms, retry, loading, cache, storage access,
authorization, or signed URL refresh.

ADR-040 remains proposed and design-only. It introduces no metadata
implementation, schema, API, storage, business rule, or viewer change in this
release.

## Migration summary

PR sequence completed platform adoption:

- PR #79B — shared foundation.
- PR #79C — MQR reference consumer.
- PR #79E — PM consumer.
- PR #79F follow-up — URL refresh centralization.
- PR #79G — Delivery/PDI consumers.
- PR #79H — Vehicle360/Machine Passport consumers.
- PR #79I — Knowledge consumer.
- PR #79J — final repository audit.
- PR #79K — dead legacy viewer/gallery removal.
- PR #79L — v1 documentation and governance.

Adoption: **100% (6/6 tracked consumer groups)**.

## Validation

- Architecture: PASS — 7 rules, 0 warnings, 0 failures.
- Typecheck: PASS.
- Lint: PASS — existing image/alt-text warnings only.
- Tests: PASS — 104 files, 832 tests.
- Build: PASS — 89 routes generated.
- Repository hygiene: PASS for the tagged release baseline.

## Known limitations

- PDF and print paths retain approved server-side rendering boundaries and
  existing layout.
- PhotoDiff and AttachmentPhotoTile retain documented legacy URL fallbacks.
- Crop persistence, OCR, AI annotation, compression, versioning, and durable
  metadata are not v1 features.
- Build retains existing `libheif` critical-dependency warning; lint retains
  existing image and alt-text warnings.

## Future roadmap

- Epic #80 — Image Metadata Foundation, design-only under ADR-040.
- Separate future epics may address crop editor, metadata implementation,
  OCR, AI annotation, compression, versioning, and search.
- Epic #81 has not started and is outside this release.

## Breaking changes

None. No API contracts, database schema, storage providers, authorization
rules, business rules, attachment IDs, legacy URL compatibility, or PDF layout
changed for this release.

## Deployment notes

1. The release was merged to `main` and tagged `v2.4.0`.
2. Post-release fixes must use a new commit and release version; do not move
   the immutable tag.
3. Confirm CI, deployment status, authentication, attachment access, signed
   resource refresh, image rendering, PDFs, and critical module smoke flows
   after every production recovery.
4. Use deployment platform rollback to last known-good release if production
   verification fails. Do not reverse database or storage state without an
   approved migration-specific rollback plan.

# ADR-039: Shared Image Presentation and Editing Platform

## Status

Accepted for the shared foundation only. PR #79B may implement the
presentation contracts, resource-state/cache abstraction, transform state,
and minimal viewer primitives described here. Module migrations, crop
persistence, storage/API/schema changes, and business-rule changes remain
out of scope and require separate approval.

## Context

The platform already has a frozen Attachment Platform (`ADR-010`) that owns
attachment identity, authorization, storage, signed URLs, retention, and
provider lifecycle. Image rendering is shared only partially: the repository
contains `AttachmentViewer`, `AttachmentGallery`, `AttachmentPhotoTile`,
module-specific URL resolution, and shared PDF image fetching with overlapping
responsibilities.

Issue #79A proposes a reusable image presentation system and an eventual
Document Image Editor. The architecture must improve reuse without reopening
the Attachment Platform or introducing a new storage, schema, API, or
business-rule model.

## Decision

Adopt a presentation-layer Image Platform above the Attachment Platform.

The Attachment Platform remains the only owner of:

- Attachment identity and ownership metadata
- Authorization and scope enforcement
- Upload, delete, list, archive, restore, and checksum operations
- Storage-provider selection and lifecycle
- Signed URL generation
- Retention behavior

The Image Platform owns:

- Thumbnail and preview rendering
- Fullscreen viewing
- Zoom, pan, temporary rotation, and reset
- Keyboard, accessibility, and mobile interaction
- Explicit viewer loading/error states
- Local crop-editor interaction state

Modules own adapters that map domain records to presentation items. Modules do
not create custom viewers or access storage providers directly.

## Resource Boundary

The presentation integration is conceptually an
`AttachmentResourceProvider`, optionally consumed by hooks such as
`useAttachmentResource()`. It is not a replacement for `AttachmentService`
and does not own authorization or storage decisions.

Its responsibilities are:

- Resolve an authorized attachment reference into a display resource
- Expose `displayUrl` and explicit resource state
- Cache resources in memory
- Handle expiry, refresh, request deduplication, and bounded retry
- Support local preview resources

The viewer receives resources and renders them. It does not infer storage
provider, fetch module records, or enforce domain authorization.

## Presentation Contract

The conceptual shared contract is:

```text
ImageItem {
  id
  attachmentId?
  displayUrl
  sourceKind
  filename?
  mimeType
  alt
  label?
  category?
  width?
  height?
  resourceState
}
```

`displayUrl` is intentionally presentation-oriented. It may be a signed URL,
CDN URL, blob URL, local preview, data URI, or cached resource. It is never a
durable identity and must not be persisted as one.

## Cache and Resource State

The resource cache is keyed by `attachmentId` and requested presentation
profile/variant. Entries expose:

- `loading`
- `loaded`
- `expired`
- `failed`
- `retrying`

The cache uses an expiry safety margin, deduplicates concurrent requests,
refreshes at most once per failed/expired request, and never stores signed
URLs in durable browser storage.

## Editing Policy

Viewing transforms are temporary. Crop editing is separate from viewing and
has explicit `Cancel`, `Discard`, and `Save` transitions.

No editor may silently overwrite original evidence. Persisted editing requires
a later approved policy defining derived attachments, versioning, or explicit
replacement with recoverability and audit behavior.

## Migration Strategy

The approved incremental order is:

```text
Architecture/ADR
→ Attachment Resource Layer
→ Shared Viewer
→ MQR
→ NTR
→ PM
→ Delivery/PDI
→ Warranty-owned consumers
→ Vehicle360
→ Crop Editor
→ Deprecation cleanup
```

The resource layer precedes viewer migration so the viewer consumes explicit
resource states rather than implementing URL refresh logic itself. Crop
follows viewer migration because it introduces data-integrity and audit
decisions that ordinary presentation does not require.

## Non-Goals

This decision does not cover OCR, AI enhancement, image search, face
recognition, metadata extraction, thumbnail-generation services, CDN redesign,
storage replacement, new schema, new ownership, new authorization, new
business rules, new PDF layouts, or silent original-file replacement.

## Consequences

Positive:

- Storage and presentation responsibilities become explicit.
- Viewer behavior becomes reusable across modules.
- Signed URL expiry is handled consistently.
- Legacy URL-only records can migrate through adapters.
- Crop is isolated from ordinary viewing and data integrity is protected.

Trade-offs:

- A resource-layer contract must be introduced before broad migration.
- Existing `AttachmentViewer` and `AttachmentGallery` require compatibility
  treatment before deprecation.
- Crop persistence remains intentionally unresolved until a separate policy is
  approved.
- Module adapters remain necessary because labels, categories, ordering, and
  required/optional semantics are domain-owned.

## Implementation Constraints

- No new database schema for the presentation platform.
- No new storage-provider access from UI or modules.
- No weakening of Attachment Platform authorization.
- No change to existing business rules.
- No removal of legacy URL fallback until all consumers are migrated and
  verified.
- No crop persistence without an explicit decision and audit policy.

## Review Outcome

## PR #79B Foundation Boundary

PR #79B implements only the shared foundation under
`src/components/shared/image/`:

- `ImageItem` and resource-state contracts
- `AttachmentResourceProvider` interface and in-memory implementation
- Expiry-aware cache, request deduplication, and bounded retry
- Transform state for zoom, pan, rotation, and reset
- Minimal `ImageThumbnail`, `ImagePreview`, `ImageViewer`, and
  `ViewerToolbar` primitives
- Unit tests for cache transitions, retry behavior, deduplication, and
  transform state

No existing module imports these primitives. MQR, NTR, PM, Delivery/PDI,
Warranty-owned consumers, and Vehicle360 remain unmigrated. Crop persistence,
storage/API/schema changes, and business-rule changes remain excluded.

**Recommendation: ACCEPT WITH MODIFICATION.**

Use a presentation-facing resource provider instead of a broad
`AttachmentResolver`; use `displayUrl` instead of a storage-shaped `url`; make
cache state explicit; and keep crop editing separate from viewer migration.

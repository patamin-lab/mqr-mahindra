# ADR-039: Shared Image Presentation and Editing Platform

## Status

Implemented, production-proven, and locked as repository standard.

PR #79B delivered foundation. PRs #79C through #79I migrated all approved
consumers. PR #79J completed repository audit. PR #79K removed verified-dead
legacy viewer/gallery code. PR #79L finalizes v1 documentation and governance.
Future extensions require separate ADR when they change data integrity,
storage, API, schema, authorization, or business rules.

## Implementation status

The shared foundation, all approved module migrations, repository audit, and
legacy cleanup are complete. Six tracked consumer groups use the platform:
MQR, NTR, PM, Delivery/PDI, Vehicle360/Machine Passport, and Knowledge.
Adoption is 100% (6/6).

## Context

The platform already has a frozen Attachment Platform (`ADR-010`) that owns
attachment identity, authorization, storage, signed URLs, retention, and
provider lifecycle. At decision time, image rendering was shared only
partially: repository contained legacy viewer/gallery components,
`AttachmentPhotoTile`, module-specific URL resolution, and shared PDF image
fetching with overlapping responsibilities. Legacy viewer/gallery code is now
removed; documented compatibility paths remain where required.

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
- Temporary transform state for ordinary viewing. Crop editing is future work
  and not part of v1.

Modules own adapters that map domain records to presentation items. Modules do
not create custom viewers or access storage providers directly.

## Resource Boundary

The presentation integration is `AttachmentResourceProvider`. It is not a
replacement for `AttachmentService`
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

Historical planned order (superseded):

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

Completed order: Architecture/ADR -> Resource Layer -> Shared Viewer -> MQR
-> NTR -> PM -> URL refresh centralization -> Delivery/PDI -> Vehicle360/
Machine Passport -> Knowledge -> Repository Audit -> Legacy Cleanup -> v1.

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

- Resource-layer contract required coordinated adapters across modules.
- Legacy viewer/gallery compatibility had to remain until all consumers were
  migrated and audited; both are now removed.
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

**FINAL: IMPLEMENTED AND PRODUCTION PROVEN.**

Architecture rules, migration behavior, compatibility paths, authorization
boundaries, PDF behavior, and validation results are recorded in
`docs/architecture/SHARED_IMAGE_PLATFORM_V1.md` and
`docs/architecture/FINAL_SHARED_IMAGE_PLATFORM_REPOSITORY_AUDIT.md`.

### Final design decisions

- Durable attachment IDs outrank transient display URLs.
- `AttachmentResourceProvider` is sole browser presentation owner for signed
  resource loading, expiry, retry, and in-memory cache.
- Shared image primitives own rendering and temporary transforms.
- Feature modules own domain adapters only.
- Attachment Platform owns authorization, storage, retention, and signed URL
  generation.
- PDF renderers retain existing server-side URL refresh and layout.

### Known exceptions

- `PhotoDiff` keeps legacy URL fallback for generic timeline callers.
- `AttachmentPhotoTile` keeps legacy URL fallback for existing upload records.
- PDF/print paths keep server-side or document-specific image handling.
- These exceptions do not create a second browser viewer or URL-refresh owner.

### Future extension points

Crop Editor, Image Metadata, AI Annotation, OCR, Image Compression, and Image
Versioning are not v1 features. Each requires compatibility review and a
separate ADR when it introduces persistence, derived files, schema, storage,
API, authorization, or business-rule effects.

## Historical record: PR #79B Foundation Boundary

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

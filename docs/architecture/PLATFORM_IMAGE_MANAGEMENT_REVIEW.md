# Issue #79A.1 — Platform Image Management

## Architecture Review Refinement

**Status:** Architecture approved; PR #79B shared foundation implemented;
module migration and editing persistence not started

**Baseline:** Production baseline `16566d9`

**Scope:** Documentation only. This document does not authorize production
code, API, schema, business-rule, commit, or pull-request changes.

## Decision Summary

| Review item | Decision | Refined position |
|---|---|---|
| AttachmentResolver boundary | Modify | Use a presentation-facing `AttachmentResourceProvider`; `AttachmentService` remains the storage and authorization boundary. |
| ImageItem contract | Accept with modification | Expose `displayUrl` as a transient presentation resource; retain `attachmentId` as the durable identity. |
| Cache state | Accept | Cache owns explicit loading, loaded, expired, failed, and retrying states. |
| Crop workflow | Accept with modification | Add explicit Cancel, Discard, and Save transitions; never silently overwrite original evidence. |
| Pull-request order | Accept | Architecture/ADR → resource layer → viewer → module migrations. |
| Design principles | Accept | Added below as governing principles. |
| Non-goals | Accept | Added below to prevent scope expansion. |

## 1. Layer Ownership

```text
Business module
  └─ maps domain fields to attachment references

Presentation resource layer
  └─ resolves display resources, cache state, expiry, retry

Image Platform
  └─ renders thumbnails, viewer, transforms, and editor state

Attachment Platform
  └─ owns attachment identity, authorization, storage, retention, and URLs

Storage providers
  └─ store and retrieve bytes
```

### Attachment Platform owns

- Attachment identity and ownership metadata
- Authorization and scope enforcement
- Upload, delete, list, archive, restore, and checksum operations
- Storage-provider selection
- Signed URL generation
- Retention and storage lifecycle
- Durable attachment metadata

### Presentation resource layer owns

- Mapping an attachment reference to a renderable resource
- `displayUrl` acquisition
- Expiry-aware caching
- Loading, loaded, expired, failed, and retrying state
- One-time refresh and retry policy
- Local preview resources such as object URLs
- Converting storage-independent resources into viewer inputs

It must not decide ownership, authorization, retention, storage provider, or
business workflow.

### Image Platform owns

- Thumbnail and preview rendering
- Fullscreen viewer behavior
- Zoom, pan, temporary rotation, and reset
- Keyboard and mobile interaction
- Viewer loading and error presentation
- Crop-editor interaction state

It must not fetch from Supabase, R2, Drive, or a module table directly.

### Business modules own

- Which attachments belong to their record
- Labels, categories, ordering, and required/optional semantics
- Whether a caller may offer delete or edit actions
- When an attachment becomes business-complete
- Domain-specific PDF ordering and captions

Modules provide adapters, not custom viewers.

## 2. Attachment Resource Boundary

The original name `AttachmentResolver` is too broad because it suggests a
platform/service concern and could invite storage or authorization logic into
the UI boundary.

The recommended abstraction is a presentation-facing resource provider,
conceptually named `AttachmentResourceProvider`. A React hook such as
`useAttachmentResource()` may consume it, but the hook is not the ownership
boundary itself.

```text
AttachmentService
  → authorized attachment metadata and signed-resource capability

AttachmentResourceProvider
  → presentation resource state and refresh policy

ImageViewer
  → renders the resource state
```

The resource provider may call an authorized Attachment API or a server-side
AttachmentService facade. It must never bypass the Attachment Platform by
calling a storage provider directly.

## 3. Refined ImageItem Contract

The viewer should not receive a property named only `url`, because that makes
the storage representation look like the viewer's input model.

Recommended conceptual contract:

```text
ImageItem {
  id: string                    // stable UI key
  attachmentId?: string        // durable identity when persisted
  displayUrl: string | null     // transient renderable resource
  sourceKind:                  // signed | cdn | blob | local | data | cached
  filename?: string
  mimeType: string
  alt: string
  label?: string
  category?: string
  width?: number
  height?: number
  resourceState: ResourceState
}
```

`displayUrl` is presentation-oriented. It may represent a signed URL, CDN
URL, blob URL, local preview, data URI, or cached resource. The viewer does
not infer its origin and does not persist it.

`attachmentId` remains optional for local previews but authoritative whenever
the image is persisted. A module may retain a legacy URL fallback during
migration, but it must not treat that URL as durable identity.

## 4. Cache Design

The cache is a presentation-resource cache, not a storage cache and not a
business-data cache.

```text
Cache key: attachmentId + requested variant/profile

Entry:
  displayUrl
  expiresAt
  state
  error
  retryCount
  lastAttemptAt
```

Recommended states:

```text
loading → loaded
loading → failed
loaded  → expired
expired → retrying → loaded
expired → retrying → failed
```

The viewer consumes `resourceState`; it must not infer expiry from image
events alone.

Rules:

- Cache signed URLs only in memory initially.
- Apply a safety margin before `expiresAt`.
- Refresh once per expired resource request.
- Deduplicate concurrent requests for the same key.
- Never retry indefinitely.
- Never cache authorization failures as successful resources.
- Do not place signed URLs in durable browser storage.
- Revoke object URLs when local previews are discarded.

Server-rendered pages may provide an initial loaded resource. The client
resource provider remains responsible for expiry and retry after hydration.

## 5. Viewer and Editor Workflow

Viewing is non-destructive:

```text
Closed → Opening → Viewing
Viewing → Loading
Viewing → Error → Retrying → Viewing
Viewing → Closed
```

Temporary zoom, pan, and rotation exist only in viewer state. `Reset`
returns the viewport to its initial state without changing the attachment.

Editing is a separate state machine:

```text
Original
  ↓ Open editor
Editing
  ├─ Cancel → Original
  ├─ Discard → Original
  └─ Save request → Saving
                    ├─ Success → Edited preview / explicit persistence result
                    └─ Failure → Editing with error
```

Requirements:

- Cancel exits without creating or changing a file.
- Discard removes the uncommitted local edit only.
- Save is an explicit user action.
- Save must not silently overwrite original evidence.
- The persistence policy must be approved before editor implementation:
  create a derived attachment, version the original, or explicitly replace
  it while retaining recoverability.
- Any persisted edit must define audit behavior and failure recovery.

Crop is therefore not part of the ordinary viewer toolbar in the first
viewer-consolidation change.

## 6. Design Principles

1. Presentation is not storage.
2. Presentation is not business logic.
3. The Attachment Platform owns storage and authorization.
4. The Image Platform owns presentation and interaction state.
5. Durable attachment IDs outrank transient URLs.
6. A viewer renders resources; it does not own domain records.
7. Modules provide adapters rather than custom viewers.
8. Temporary transforms do not mutate persisted evidence.
9. Editing never mutates original evidence without an explicit approved policy.
10. Signed URLs are capabilities with expiry, not permanent data.
11. Authorization is enforced before resource resolution, not by the viewer.
12. Shared abstractions must reduce duplication without erasing domain labels,
    ordering, or required/optional semantics.
13. Compatibility with legacy URL-only records is maintained during migration.
14. New image capability is added behind stable boundaries and migrated
    incrementally.

## 7. Non-Goals

Issue #79A does not attempt to deliver:

- OCR
- AI enhancement or generative restoration
- Image search
- Face recognition
- Metadata extraction as a new platform capability
- A thumbnail-generation service
- CDN redesign
- Storage-provider replacement
- Storage-provider failover
- New database schema
- New attachment ownership model
- New attachment authorization rules
- New business rules
- Automatic image classification
- Image deduplication
- Customer-facing image sharing
- New PDF document layouts
- Silent replacement of original evidence

## 8. Migration Strategy

The roadmap sequencing remains unchanged. The implementation dependency order
is refined as follows:

```text
PR1  Architecture and ADR
 ↓
PR2  Attachment Resource Layer
 ↓
PR3  Shared Viewer and transform state
 ↓
PR4  MQR migration
 ↓
PR5  NTR migration
 ↓
PR6  PM migration
 ↓
PR7  Delivery/PDI migration
 ↓
PR8  Warranty-owned attachment consumers
 ↓
PR9  Vehicle360 migration
 ↓
PR10 Crop editor, only after persistence policy approval
 ↓
PR11 Deprecation cleanup
```

The resource layer precedes the viewer because the viewer must be tested
against explicit resource states rather than inventing URL refresh behavior.
Crop follows viewer migration because it introduces data-integrity and audit
decisions beyond presentation-only viewing.

## 9. Component Ownership

| Component | Owner | Boundary |
|---|---|---|
| `AttachmentService` | Attachment Platform | Storage, authorization, lifecycle |
| `AttachmentResourceProvider` | Presentation platform | Resource acquisition, cache, expiry, retry |
| `ImageThumbnail` | Image Platform | Non-destructive thumbnail rendering |
| `ImageViewer` | Image Platform | Preview, navigation, fullscreen, transforms |
| `ImageViewport` | Image Platform | Zoom, pan, rotation, reset |
| `ImageCropEditor` | Image Platform | Local edit interaction; no implicit persistence |
| Module attachment adapter | Business module | Domain mapping, labels, categories, ordering |
| PDF image adapter | Shared PDF layer | Data-URI resolution and PDF-safe rendering |

## 10. Pull-Request Breakdown

1. Architecture and ADR documentation.
2. Attachment Resource Layer contract and implementation.
3. Shared Viewer, viewport, accessibility, and explicit resource states.
4. MQR migration and PDF regression verification.
5. NTR migration, including document-orientation profiles.
6. PM migration and the remaining PM lightbox gap.
7. Delivery/PDI migration with authorization regression verification.
8. Warranty-owned attachment consumer review; no new Warranty owner.
9. Vehicle360/Machine Passport migration.
10. Crop editor, only after a separate persistence decision is accepted.
11. Removal of deprecated duplicate viewer paths after all consumers migrate.

PR #79B implements only the shared foundation in
`src/components/shared/image/`: the presentation contract, resource provider
and cache state, transform reducer, toolbar, thumbnail, preview, viewer, and
unit tests. No existing module imports these primitives yet.

## Final Recommendation

Adopt the refined boundary. Do not introduce a storage-facing
`AttachmentResolver` between the Attachment Platform and UI. Introduce a
presentation resource abstraction whose implementation is constrained to
resource state, caching, expiry, and retry.

Create ADR-039 as a proposed architecture decision. Keep Issue #79A focused
on shared presentation and incremental migration. Treat crop persistence as
a separately gated capability.

**Status: FOUNDATION IMPLEMENTED — READY FOR REVIEW**

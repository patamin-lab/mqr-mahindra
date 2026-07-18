# ADR-040: Image Metadata Foundation

## Status

Proposed. Design-only for Epic #80. No production code, schema, API, storage,
viewer, or business-rule change is approved by this draft.

ADR-039 remains locked and unchanged. This ADR extends the platform beside
v1; it does not redesign v1.

## Context

The Attachment Platform currently owns durable attachment identity, module and
entity ownership, filename, MIME type, size, checksum, storage provider/path,
archive lifecycle, and authorization boundaries.

Shared Image Platform v1 currently owns `ImageItem` presentation identity and
transient resource state. `AttachmentResourceProvider` owns signed-resource
loading, expiry, retry, request deduplication, and in-memory cache. Neither is
an appropriate owner for durable image metadata.

Future capabilities need reusable metadata without coupling metadata to a
viewer, signed URL, storage provider, or business module:

- Crop and derived image versions
- OCR and AI annotations
- Compression and generated variants
- Duplicate detection
- Metadata search and filtering

## Decision proposal

Introduce a platform-owned Image Metadata layer above the Attachment Platform
and beside Shared Image Platform v1.

```text
Attachment Platform
  identity, ownership, authorization, storage, size, MIME, checksum, lifecycle

Image Metadata Platform
  canonical technical metadata, extraction state, provenance, extension seams

Shared Image Platform v1
  ImageItem, resource loading, thumbnail, preview, viewer, transforms

Business modules
  domain mapping and labels only
```

Metadata is keyed by durable `attachment_id`. It contains no signed URL,
storage provider, storage path, bucket, or module-specific business state.

## Ownership

Attachment Platform remains authoritative for:

- Attachment ID, module, entity, type, filename
- MIME type and byte size
- Checksum and storage integrity
- Authorization and scope
- Storage provider and lifecycle

Image Metadata Platform owns:

- Canonical image dimensions and orientation
- Capture-time metadata when present and provenance is known
- Metadata extraction status, version, and error state
- Namespaced custom metadata subject to validation and privacy policy
- Extension contracts for variants, processing, OCR, annotations, and versions

Shared Image Platform v1 remains authoritative for:

- Rendering and viewer behavior
- Signed-resource loading and refresh
- Cache, loading, error, retry, and transient transform state

Business modules own no metadata schema. They may supply domain labels through
existing adapters, but may not become metadata owners.

## Logical data model

### Existing authoritative fields

Do not duplicate these in an image metadata table:

| Field | Current owner | Metadata access |
| --- | --- | --- |
| MIME type | `attachments.mime_type` | Read through attachment reference |
| File size | `attachments.size_bytes` | Read through attachment reference |
| Checksum | `attachments.checksum` | Read through attachment reference |
| Filename | `attachments.filename` | Read through attachment reference |
| Identity/ownership | `attachments.*` | Read through authorized attachment service |

### Proposed `image_metadata` record

Logical model only. Exact SQL types, indexes, RLS, and migration require a
separate implementation ADR/PR.

| Field | Meaning | Rule |
| --- | --- | --- |
| `attachment_id` | One metadata record per image attachment | Durable key; unique |
| `metadata_schema_version` | Shape version | Monotonic, platform-owned |
| `metadata_status` | `PENDING`, `AVAILABLE`, `PARTIAL`, `FAILED`, `STALE` | Processing state, not business state |
| `width_px` | Canonical pixel width | Positive integer; nullable until extracted |
| `height_px` | Canonical pixel height | Positive integer; nullable until extracted |
| `orientation` | EXIF orientation 1-8 or normalized orientation value | Preserve source and normalized interpretation explicitly |
| `captured_at` | Source capture timestamp | Nullable; never infer without provenance |
| `metadata_source` | `EXIF`, `DECODER`, `UPLOAD`, `USER`, `DERIVED` | Every non-empty field needs provenance |
| `custom_metadata` | Namespaced extension object | Validated keys; no secrets or URLs |
| `extracted_at` | Last successful extraction time | Operational timestamp |
| `updated_at` | Metadata record update time | Operational timestamp |
| `error_code` | Safe extraction failure code | No raw provider error or sensitive payload |

`mime_type`, `size_bytes`, and `checksum` remain in `attachments`. Metadata
read models may project them together, but must not create competing copies.

### Derived and future models

Do not add nullable status columns for every future capability to
`image_metadata`. Use extension records keyed by `attachment_id`:

- `image_derived_assets`: thumbnail, preview, compressed output, or other
  generated asset descriptors and processing status.
- `image_versions`: parent/child attachment relationship, version number,
  operation provenance, and active-version policy.
- `image_ocr_results`: OCR engine/version, status, language, text reference,
  confidence summary, and retention policy.
- `image_annotations`: annotation type, geometry, label, model/user source,
  confidence, and moderation status.
- `image_operations`: generic idempotent processing job state for extraction,
  compression, OCR, annotation, crop, or duplicate analysis.

These are extension points, not Epic #80 implementation commitments.

## Contract proposal

Define an independent metadata contract conceptually equivalent to:

```text
ImageMetadata {
  attachmentId
  schemaVersion
  status
  widthPx?
  heightPx?
  orientation?
  capturedAt?
  source
  customMetadata
  extractedAt?
  errorCode?
}
```

`ImageItem.width` and `ImageItem.height` remain optional presentation hints.
They are not the metadata system, and v1 does not require changing
`ImageItem`. A future adapter may copy canonical dimensions into an ImageItem
snapshot without making the viewer fetch or own metadata.

## Extension points

1. `ImageMetadataExtractor`: decoder/EXIF extraction behind a platform
   interface. Input is authorized bytes or a platform-owned read capability;
   implementation does not know business modules.
2. `ImageMetadataService`: validates, normalizes, versions, and persists
   metadata. It does not render images or issue signed URLs.
3. `ImageMetadataRepository`: persistence-only boundary. No storage SDK or
   browser dependency.
4. `ImageMetadataReadModel`: authorized read projection for adapters, search,
   and future processing services.
5. `ImageOperationProcessor`: asynchronous, idempotent seam for derived
   assets, OCR, AI, compression, crop, and duplicate analysis.
6. Attachment lifecycle events: upload finalized, attachment archived,
   restored, replaced, or purged may trigger metadata work. Event consumers
   must remain retryable and must not change business state implicitly.
7. Module adapter seam: modules request metadata by attachment ID and map
   display labels; they do not write platform metadata directly.

## Privacy and integrity rules

- Treat capture time, GPS, device identifiers, and custom metadata as
  potentially sensitive. GPS extraction is disabled by default until policy
  approves it.
- Never trust client-supplied dimensions, checksum, or capture time as
  authoritative without provenance.
- Extraction must be deterministic for the same byte content and extractor
  version where practical.
- Preserve source metadata separately from normalized values when lossless
  audit matters; do not expose raw EXIF wholesale by default.
- Metadata reads follow attachment authorization. Metadata must not become an
  indirect cross-tenant discovery channel.
- Metadata deletion follows attachment purge policy; retention exceptions need
  explicit approval.

## Alternatives rejected

### Add every field to `attachments`

Rejected. Couples generic attachment lifecycle to image-only and future
capabilities, creates null-column growth, and makes non-image attachments carry
irrelevant state.

### Put metadata inside `ImageItem`

Rejected as system of record. `ImageItem` is a presentation contract and may
be transient or local; durable metadata must be reusable by non-visual
processes such as search, OCR, and duplicate detection.

### Store metadata in `AttachmentResourceProvider`

Rejected. Provider owns transient resources, expiry, retry, and cache. Metadata
must survive URL expiry and remain available without browser rendering.

### Module-owned metadata tables

Rejected. Produces incompatible schemas and prevents cross-module search,
deduplication, and future processing reuse.

### Storage sidecar files

Rejected as primary model. Sidecars couple metadata to provider layout,
complicate authorization, and make migration between providers harder.

## Migration strategy

Documentation-only Epic #80 does not migrate data or add schema.

Future implementation sequence:

1. Approve this ADR and metadata contract; define privacy and retention policy.
2. Inventory image MIME types, incomplete uploads, legacy URLs, and existing
   dimensions across all six consumers.
3. Implement read-only metadata extraction in a platform service with fixtures
   for JPEG, PNG, WebP, HEIC, unsupported files, corrupt files, and no-EXIF
   files.
4. Add metadata persistence and backfill as a separately approved migration.
   Backfill must be resumable, idempotent, observable, and non-blocking.
5. Expose authorized metadata read model to module adapters. Keep v1 viewer
   behavior unchanged; dimensions remain optional hints.
6. Add derived-asset processing only through a separate ADR and operation
   processor.
7. Deliver Crop, OCR, AI, compression, duplicate detection, versioning, and
   search as separate small epics with independent rollback and validation.

## Risk assessment

| Risk | Level | Mitigation |
| --- | --- | --- |
| Client-supplied metadata is false | High | Extract server-side; preserve provenance and status |
| EXIF privacy leakage | High | Redaction policy; GPS disabled by default; authorized reads |
| HEIC/codec/platform variance | Medium | Capability matrix, fixture corpus, failed/partial states |
| Large-file extraction cost | Medium | Async jobs, limits, idempotency, bounded concurrency |
| Metadata/schema drift | Medium | Schema version, contract tests, extension tables |
| Tenant data exposure | High | Attachment authorization before metadata read; no public metadata endpoint |
| Provider coupling | Medium | Attachment ID only; no URL/provider/path in metadata model |
| Backfill regression | Medium | Read-only phase, resumable jobs, metrics, rollback by status |
| Duplicate/hash semantics | Medium | Define exact algorithm and byte scope before enabling detection |
| Retention mismatch | Medium | Metadata lifecycle follows attachment purge/archive policy |

## Future roadmap

| Capability | Depends on | Separate decision needed |
| --- | --- | --- |
| Crop | Versions, derived assets, audit | Yes |
| OCR | Operation processor, privacy policy, language policy | Yes |
| AI annotation | Operation processor, model governance, moderation | Yes |
| Compression | Derived assets, quality policy, variant selection | Yes |
| Duplicate detection | Canonical hash/perceptual hash policy, privacy | Yes |
| Image versioning | Parent/child model, active-version and rollback policy | Yes |
| Search | Authorized read model, indexing and retention policy | Yes |

## Consequences

Positive:

- Metadata becomes reusable across every module and future capability.
- v1 viewer/resource/storage boundaries remain intact.
- Technical metadata can be backfilled without changing business records.
- Future features gain stable seams without a metadata column explosion.

Costs:

- New platform ownership and lifecycle need governance.
- Extraction, privacy, and backfill require operational tooling.
- Some metadata remains unavailable or partial for legacy/corrupt files.

## Approval gate

Approve this ADR only as architecture design. Production implementation needs
separate PRs for contract, schema, extractor, persistence, backfill, privacy
controls, and each future capability. No Epic #80 implementation is included
in this document-only proposal.

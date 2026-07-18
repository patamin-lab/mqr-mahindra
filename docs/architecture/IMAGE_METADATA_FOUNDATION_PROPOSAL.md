# Epic #80 — Image Metadata Foundation Proposal

Status: Design-only. ADR-039 and Shared Image Platform v1 remain locked.

## 1. Architecture proposal

Create Image Metadata Platform as independent platform service. Place it above
Attachment Platform and beside Shared Image Platform v1.

```text
Business module adapter
        |
        v
Authorized metadata read model <--- Image Metadata Service
        |                               |
        v                               v
     ImageItem                    Image Metadata Repository
                                        |
                                        v
                               image_metadata records

AttachmentResourceProvider remains separate:
signed URL, expiry, retry, cache, resource state.
```

Metadata references `attachment_id`, never URL, bucket, provider, or storage
path. Rendering can consume optional metadata snapshots, but metadata never
depends on rendering.

## 2. Current-state analysis

### Attachment model

Current `attachments` model already provides durable fields:

- identity and module/entity ownership
- attachment type and filename
- MIME type
- byte size
- SHA-256 checksum when upload path can compute it
- storage provider/path and archive lifecycle
- created/updated/business-completed timestamps

Direct-upload placeholders may have `size_bytes = 0` and `checksum = null`
until finalize. Metadata extraction must treat these as `PENDING`, not as a
valid zero-byte image.

### Current `ImageItem`

`ImageItem` currently contains:

- durable `attachmentId` when persisted
- transient `displayUrl` and source kind
- filename, MIME type, alt, label, category
- optional width/height presentation hints
- expiry and resource state/error

Width and height are useful to rendering, but are not a durable metadata
system. `ImageItem` must not become a database record or metadata owner.

### Current `AttachmentResourceProvider`

Provider owns `get`, `refresh`, `invalidate`, snapshots, subscriptions,
expiry-aware cache, request deduplication, bounded retry, and injected loading.
It must remain unaware of EXIF, OCR, annotations, compression, versions, and
business records.

## 3. Metadata model

### Foundation record

`image_metadata` is a logical one-to-one record keyed by `attachment_id`.
It stores canonical image facts and extraction lifecycle:

```text
attachment_id                  durable reference
metadata_schema_version        contract version
metadata_status                PENDING | AVAILABLE | PARTIAL | FAILED | STALE
width_px, height_px            canonical dimensions
orientation                    source/normalized orientation
captured_at                    optional source capture time
metadata_source                EXIF | DECODER | UPLOAD | USER | DERIVED
custom_metadata                namespaced validated extension object
extracted_at                   last successful extraction
updated_at                     record update time
error_code                     safe failure category
```

`mime_type`, `size_bytes`, `checksum`, filename, identity, and ownership stay
authoritative in `attachments`. Read models may join them; no duplicate source
of truth.

### Extension records

Keep future capability state out of one wide nullable row:

- `image_derived_assets`: thumbnail, preview, compressed variant.
- `image_operations`: idempotent async extraction/processing jobs.
- `image_versions`: parent/child graph and active version policy.
- `image_ocr_results`: engine, language, confidence, text, status.
- `image_annotations`: geometry, labels, model/user provenance, confidence.

No extension record is implemented by Epic #80.

## 4. Metadata independence rules

- No metadata URL.
- No storage provider, bucket, or path.
- No signed URL refresh.
- No viewer or React dependency.
- No business-module columns or business rules.
- No authorization bypass; metadata reads require attachment authorization.
- No client claim becomes authoritative without provenance.
- No raw EXIF or GPS exposure by default.

## 5. Extension points

### Extraction

`ImageMetadataExtractor` accepts authorized bytes/read capability and returns
canonical metadata plus provenance. Decoder choice stays behind interface.

### Service/repository

`ImageMetadataService` owns validation, normalization, status, and schema
version. `ImageMetadataRepository` owns persistence only. Neither owns URLs or
rendering.

### Processing

`ImageOperationProcessor` provides idempotent asynchronous operation state.
Crop, OCR, AI, compression, duplicate detection, and versioning become
separate operation types with separate policies.

### Read integration

Module adapters may request authorized metadata by attachment ID and copy
dimensions into `ImageItem` as optional hints. They do not persist metadata or
call storage directly.

## 6. Migration strategy

No implementation in this Epic.

Future sequence:

1. Approve ADR and privacy/retention policy.
2. Inventory current records and unsupported/corrupt formats.
3. Build read-only extractor and fixture corpus.
4. Add persistence and resumable backfill in separate PR.
5. Add authorized read model; keep v1 UI behavior unchanged.
6. Add derived assets and processing jobs separately.
7. Deliver each future capability as independent epic.

Backfill requirements: idempotent, resumable, bounded, observable, retryable,
and safe to pause. Metadata failure must never block existing image rendering.

## 7. Risk assessment

- Privacy: EXIF GPS/capture/device data can expose sensitive information.
- Integrity: dimensions, hashes, and capture time need provenance.
- Compatibility: legacy URLs and attachment IDs remain unchanged.
- Performance: decoding large/HEIC files needs async limits.
- Availability: metadata failure must degrade to v1 behavior.
- Governance: future fields need extension records, not unreviewed columns.
- Authorization: metadata must follow Attachment Platform scope checks.

## 8. Future roadmap

| Phase | Capability | Gate |
| --- | --- | --- |
| v2.0 | Intrinsic metadata and read model | ADR + privacy policy |
| v2.1 | Resumable metadata backfill | Operational runbook |
| v2.2 | Derived thumbnails/compression | Asset lifecycle ADR |
| v2.3 | Crop/versioning | Audit and rollback policy |
| v2.4 | OCR | Data retention/language policy |
| v2.5 | AI annotation | Model governance/moderation |
| v2.6 | Duplicate detection/search | Hash/index/authorization policy |

## 9. Decision summary

Recommended: approve metadata architecture as a design foundation only.
Do not alter v1 contracts, `attachments`, `ImageItem`,
`AttachmentResourceProvider`, APIs, storage, or business modules in Epic #80.

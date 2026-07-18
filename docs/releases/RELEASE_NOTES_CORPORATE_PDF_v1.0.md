# Release Notes — Corporate PDF Standardization v1.0

**PR**: #78 (`feature/corporate-pdf-standardization` → `main`)
**Merge commit**: `6ef759dd01cf5aecc37286c78dfb37c24f2b654c`
**Merged**: 2026-07-18, by `patamin-lab`
**Predecessor**: PR #77 (Production bug fixes + list/image standardization, Phase 1-3), merge commit `13d62c4`

This release standardizes every existing production PDF (NTR, PM, MQR — Quality Report) onto one shared framework, fixes a production defect where photos were missing from generated PDFs, and adds bilingual Thai/English output for free-text fields via Google Cloud Translation. No business logic, database schema, or authorization behavior changed — every change is presentation/generation infrastructure.

## New Features

- **Bilingual PDF (Thai / English)** — every free-text field on the NTR/MQR/PM PDFs that maps to an existing schema field now shows both the original Thai text (source of truth, always preserved verbatim) and an English translation, rendered via the new shared `BilingualField` PDF component.
- **Google Cloud Translation integration** — `GoogleTranslateProvider` calls the Cloud Translation v2 REST API. Selected automatically when `GOOGLE_TRANSLATE_API_KEY` is configured in the deployment environment; falls back to a no-op provider (Thai shown, English marked "Translation unavailable") when it isn't, so PDF generation never depends on translation being configured.
- **Engineering terminology normalization** — a curated Thai→English glossary for tractor/service terminology (Front Axle, Rear Axle, Front Wheel Hub, Bearing, Oil Seal, Hydraulic Cylinder, Hydraulic Pump, Lower Link, Top Link, PTO Shaft, Final Drive, Gearbox, Clutch), applied to the Thai source text before translation so the approved English term is what actually reaches the final output.
- **Acronym protection** — PTO, RPM, ECU, CAN, VIN, ABS, 4WD, 2WD are held back with a placeholder token before translation and restored verbatim afterward, guaranteeing they're never altered by machine translation.

## Improvements

- **Shared PDF framework** — new `src/lib/pdf/` primitives (`PdfHeader`, `PdfFooter`, document metadata, filename convention) replace three near-identical, independently-drifting header/footer implementations across MQR/NTR/PM with one shared structure. Every generated PDF now carries real file metadata (Title/Author/Creator/Producer) for the first time.
- **Image rendering stability** — MQR's and PM's photo boxes used `objectFit: 'cover'` on a fixed box, which crops any photo whose aspect ratio didn't match. Changed to `contain` (matching NTR's existing correct pattern) — a photo's orientation, aspect ratio, and resolution are now always preserved; images are never cropped, stretched, or distorted.
- **Signed URL handling** — all three PDF export routes now re-resolve a fresh signed URL for every photo/attachment immediately before rendering, the same fix the app's own detail pages already had. Previously, any photo whose signed URL had expired between upload and PDF export (the common case for a report reviewed after submission) silently disappeared from the PDF.
- **PDF diagnostics** — every image fetch failure (expired link, wrong content type, empty body, timeout, network error) is now logged server-side with the specific reason, and the PDF itself shows a concise "Image unavailable (`<reason>`)" placeholder instead of a blank gap or a generic message.

## Bug Fixes

- **Missing PDF images** — root cause: none of the three export routes (MQR/NTR/PM) ever refreshed a record's persisted photo/video URLs before rendering, so any photo older than its signed URL's TTL 403'd and vanished with no trace. Fixed by resolving fresh URLs via `AttachmentService.getUrl()` in every renderer, failing open to the stored URL for legacy records with no `attachmentId`.
- **Translation pipeline ordering** — terminology/unit normalization was originally applied to the translation provider's *output*, which only appeared correct against hand-written test fixtures; a real provider returns fully English text with no Thai substrings left to match, making the glossary a silent no-op. Fixed by re-ordering the pipeline to substitute terminology/units into the Thai *source* before it reaches the provider.
- **PDF generation stability** — translation failures (missing API key, provider error, timeout, malformed response) are guaranteed to never throw or block PDF generation; every path returns a safe fallback result.

## Explicitly not included in this release

Per this release's own scope boundary: no Translation Memory, no AI-assisted translation learning, no glossary management UI, no translation approval workflow. See "Future" in `docs/ROADMAP.md` (Engineering Language Platform).

## Configuration required for full functionality

`GOOGLE_TRANSLATE_API_KEY` must be provisioned in the production environment (Vercel Project Settings) for live English translation to actually run. Until it is, every bilingual field will show "Translation unavailable" — this is the documented, safe fallback, not a defect. See `.env.example`.

## Verification

`npm run architecture` 6/6 PASS · `eslint .` 0 errors · `tsc --noEmit` clean · `vitest run` 773/773 passing · `next build` 89/89 pages. CI on `main` post-merge: green (`verify` check + Vercel deployment both successful).

## Follow-up work tracked separately

- Issue #79 — Platform Image Management (shared thumbnail/viewer standardization gaps, Document Image Editor).
- Issue #80 — Placeholder-based terminology preservation (replaces mixed-language injection with a placeholder/restore mechanism, the same pattern acronym protection already uses).

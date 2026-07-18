# HANDOFF.md

Purpose: let a new engineer or AI agent understand the current state of this
project without reading old pull requests or chat history. If anything here
conflicts with the actual code, database schema, or an ADR, **trust the code
first** — this document is a snapshot, not a source of truth. See root
`CLAUDE.md` for the full living spec this file summarizes.

Snapshot date: 2026-07-18, `main` @ `641961c`.

---

## Project Overview

**Purpose**: MQR (Market Quality Report) is Mahindra's dealer quality-incident
reporting system. Dealers/technicians file quality reports (serial number,
problem code/severity, photos, video, GPS, root cause, parts, repair outcome).
Central/regional admins review, filter, export, and track them via a KPI
dashboard. Every report gets a PDF (with QR code) and an email via Resend.
Vehicle master data syncs in from a "Tractor IN" Google Sheet.

**Technology stack**: Next.js 14.2.35 (App Router, TypeScript), deployed on
Vercel (team `MSEAL`, Hobby plan). Supabase (Postgres 17) for DB + RLS, no
Supabase Auth — custom JWT sessions via `jose`. Google Drive (OAuth2) and
Cloudflare R2 / Supabase Storage for file storage behind a shared Storage
Platform. Tailwind CSS + SweetAlert2 for UI. `react-pdf` for PDF generation.
Resend for email. Google Cloud Translation v2 REST API for bilingual PDFs.

**Repository structure**: all working application code is under `src/`
(`app/` routes, `lib/` shared services, `features/` per-domain service
layers, `components/` shared UI, `shared/` cross-cutting platform code).
`modules/`, `shared/` (root-level), and `templates/` are **scaffolding only**
— README placeholders, no executable code, not yet adopted (see
`.claude/CLAUDE.md` "Sprint 1 status"). Do not confuse root-level `shared/`
with the real `src/shared/`. Documentation lives under `docs/` (`adr/`,
`architecture/`, `governance/`, `releases/`, `operations/`, `deployment/`,
`standards/`, `engineering/`).

**Current production status**: Live and stable at `masp-mseal.vercel.app`.
Repository is public (`github.com/patamin-lab/mqr-mahindra`), branch `main`.
No open release blockers as of this snapshot.

---

## Current Release

- **Current version tag**: `v1.0-platform-foundation` is the last formal
  tag/release (predates current rules on tag creation); no new tag has been
  cut for the work below — it shipped as ordinary merges to `main`.
- **Latest merged PR**: #78, "Corporate PDF Standardization".
- **Merge commit**: `6ef759dd01cf5aecc37286c78dfb37c24f2b654c`, merged
  2026-07-18T01:16:37Z by `patamin-lab`.
- **Predecessor PR**: #77, "Production bug fixes + list/image
  standardization (Phase 1-3)", merge commit `13d62c4b6e632863da902fa03218597e7a004010`.
- **Deployment status**: Vercel deployment for `main` HEAD succeeded
  (`SUCCESS` check, "Deployment has completed").
- **CI status**: green — `verify` required check passed on `main` HEAD.
- **Production readiness**: Ready. One known non-blocking gap:
  `GOOGLE_TRANSLATE_API_KEY` is not yet provisioned in the production
  environment (see Known Limitations).
- Full release notes: `docs/releases/RELEASE_NOTES_CORPORATE_PDF_v1.0.md`.
  Manual verification script: `docs/releases/SMOKE_TEST_CHECKLIST_CORPORATE_PDF_v1.0.md`.

---

## Recent Major Changes

(Completed and merged only.)

- **Shared PDF Framework** — `src/lib/pdf/` (`PdfHeader`, `PdfFooter`,
  `metadata.ts`, `filename.ts`, `sharedPdfStyles`, `fonts.ts`,
  `fetchImage.ts`, `resolveAttachmentUrl.ts`, `BilingualField.tsx`) replaces
  three independently-drifting header/footer implementations across
  MQR/NTR/PM PDFs with one shared structure. Every PDF now carries real
  document metadata.
- **Corporate PDF Standardization (PR #78)** — all three PDF renderers
  (`exportPdf.tsx`, `ntrPdf.tsx`, `maintenancePdf.tsx`) migrated onto the
  shared framework.
- **Bilingual PDF (Thai/English)** — free-text fields render both the
  original Thai (source of truth, always preserved) and an English
  translation via `BilingualField`.
- **Google Cloud Translation integration** — `GoogleTranslateProvider`
  (Cloud Translation v2 REST via plain `fetch()`, no new dependency),
  selected automatically via `createMachineTranslationProvider()` when
  `GOOGLE_TRANSLATE_API_KEY` is set; falls back to a no-op provider
  otherwise.
- **Engineering terminology normalization** — curated Thai→English glossary
  for tractor/service terms (`terminologyDictionary.ts`), applied to the
  Thai source before translation.
- **Acronym protection** — PTO/RPM/ECU/CAN/VIN/ABS/4WD/2WD held via
  placeholder tokens through translation and restored verbatim after.
- **Image rendering fixes** — MQR/PM photo boxes changed from
  `objectFit: 'cover'` (cropping) to `contain` (letterboxed, never
  cropped), matching NTR's already-correct pattern.
- **Signed URL handling fix** — all three PDF export routes now re-resolve
  a fresh signed URL immediately before rendering, fixing photos that
  silently vanished from PDFs once their original signed URL's TTL expired.
- **Production bug fixes + list/image standardization (PR #77, Phase 1-3)**
  — see `docs/releases/` for that release's own notes; predates this
  snapshot's active work but is the immediate prior completed milestone.
- **Authorization Scope platform** — `DealerBranchScope`
  (`lib/dealerBranchScope.ts`) is the standing, frozen platform standard
  for dealer/branch-level authorization; not new this release, but the
  active architectural baseline every module builds on (see Architecture,
  below).

---

## Known Limitations

- `GOOGLE_TRANSLATE_API_KEY` is not yet configured in the production
  environment. Until it is, bilingual PDF fields show "Translation
  unavailable (`<reason>`)" — this is the documented, safe fallback, not a
  defect. PDF generation itself never fails or hangs because of it.
- Translation pipeline currently injects approved English terminology
  directly into the Thai source sentence before translation (mixed-language
  injection), rather than using a placeholder-token mechanism. Functionally
  correct today; documented as technical debt in Issue #80, not yet
  addressed.
- Placeholder-based terminology preservation (the fix for the above) is
  **not yet implemented** — tracked as Issue #80, Priority 2 for v2.4.
- Translation Memory, translation review/approval workflows, and a glossary
  management UI are **intentionally deferred** — explicitly out of scope
  for PR #78 and not scheduled on any current milestone (see Do Not Do).
- PM's detail page renders through the shared `AttachmentGallery` component
  but omits the `linkable` prop, so it doesn't actually get the
  zoom/fit/rotate/fullscreen lightbox the rest of the platform has —
  tracked as part of Issue #79.
- Upload-time image processing (EXIF-upright, resize, document-vs-photo
  orientation handling) is wired into NTR's form only; PM and MQR upload
  raw files with no equivalent processing — tracked as part of Issue #79.

---

## Open Issues

- **#79 — Platform Image Management.** Purpose: closes the remaining
  display-standardization gap from PR #77 (PM's missing lightbox,
  upload-time processing not extended to PM/MQR, inconsistent thumbnail
  sizing across modules) and scopes a shared Document Image Editor
  (rotate/crop/zoom/pan) for already-uploaded attachments. Priority: 1
  (v2.4). Status: open, design/scoping document only — no implementation
  started, no PR opened against it.
- **#80 — Tech debt: replace mixed-language terminology injection with
  placeholder preservation in translation pipeline.** Purpose: replace the
  current approach (splicing approved English terms into the Thai sentence
  before translation) with a placeholder-token mechanism resolved after
  translation, the same pattern acronym protection already uses. Explicitly
  not a defect in the shipped PR #78 pipeline. Priority: 2 (v2.4). Status:
  open, documented as technical debt only — no implementation started.

No other open issues exist in the repository as of this snapshot.

---

## Technical Debt

**High**
- Core security/business-logic modules have no direct test coverage:
  `src/lib/auth.ts`, `src/lib/scope.ts`, `src/lib/db.ts` (2,807 lines, 85
  exports, 19 tables' worth of mixed concerns). A regression in any of
  these would be a security incident, not just a bug.
- Legacy unsalted SHA-256 password hashes persist indefinitely for any
  account that hasn't logged in since the scrypt migration (silent
  upgrade-on-login only covers active users).
- Large-file upload path has no server-enforced size limit
  (`createSignedUploadUrl` passes no `fileSizeLimit`) and no MIME/magic-byte
  validation — both depend on unmanaged Supabase dashboard config or
  client-supplied values.
- No error-tracking/observability layer at all (no Sentry, no structured
  logging, no health-check endpoint) — production incidents are currently
  detected by users, not the system.

**Medium**
- `src/lib/db.ts` decomposition — a single god-module mixing MQR/NTR/PM/
  vehicle/master-data/audit concerns; needs a scoped decomposition plan
  before it grows further, not an emergency rewrite.
- No ADR exists for PR #78's shared PDF framework or the Google Translate
  provider integration — a real architecture decision shipped undocumented.
- MQR's `records` API validates input ad hoc (manual `String()`/regex)
  while NTR/PM use zod schemas — inconsistent validation discipline.
- No caching/memoization on translation calls — every PDF export re-calls
  Google Translate per field, uncached.
- 69 `Promise.all` call sites vs. 2 `Promise.allSettled` across page
  loaders — a single failed sub-query can crash an entire page render
  instead of degrading gracefully.

**Low**
- `.env.example` missing 4 vars actually read in code: `PASSWORD_EXPIRY_DAYS`,
  `PASSWORD_MIN_AGE_HOURS`, `WARRANTY_GENERAL_MONTHS`,
  `WARRANTY_POWERTRAIN_MONTHS`.
- DealerBranchScope and the Storage Platform/R2 decision live in prose docs
  (`docs/engineering/STORAGE_PLATFORM_DECISION.md`) rather than formal ADRs.
- One inline role check outside `scope.ts`
  (`api/attachments/orphan-cleanup/route.ts`).
- Sequential (non-parallelized) per-family DB writes in maintenance program
  sync (`db.ts`, `syncMaintenanceProgramVersionsForInterval`).

Full detail and evidence trail for all of the above: the post-release
engineering review delivered in this repo's working session on 2026-07-18
(not persisted as a separate doc file — re-derive from source if the
underlying code has since changed).

---

## Architecture

- **RBAC model**: four roles (`SuperAdmin` > `CentralAdmin` > `DealerAdmin`
  > `DealerUser`), enforced via `users.role`. All predicates centralized in
  `src/lib/scope.ts` (`seesAllDealers`, `canUpdateStatus`, `canDelete`,
  `canExport`, `canManageUsers`, etc.) — never duplicate role-check logic
  inline. See ADR-013 (Authorization Scope).
- **Authorization Scope (DealerBranchScope)** — `src/lib/dealerBranchScope.ts`
  is the shared server-side module every module's dealer/branch filtering
  goes through (`resolveDealerScope`, `resolveBranchScope`,
  `assertBranchAccess`, `canAccessDealerBranch`). `DealerUser` visibility is
  **branch-scoped**, not just their own records — a service branch is a
  team. Client-side counterpart: `useDealerBranchScope()`/
  `<DealerBranchSelector>`. This is a **frozen platform layer** — bug/
  security/performance fixes only, no parallel implementations. See
  ADR-013 and `docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`.
- **Shared PDF Framework** — `src/lib/pdf/` provides header/footer/
  metadata/filename/style/font/image-resolution primitives shared by all
  three PDF renderers (`exportPdf.tsx`, `ntrPdf.tsx`, `maintenancePdf.tsx`).
  No ADR yet (flagged as a gap above).
- **Storage Platform** — every module's file storage follows
  `Business Module → AttachmentService → AttachmentRepository →
  StorageProviderFactory → Supabase/Cloudflare R2` (or Google Drive for
  legacy paths). Frozen platform layer. See ADR-010 (Attachment Platform)
  and `docs/engineering/STORAGE_PLATFORM_DECISION.md` /
  `STORAGE_PLATFORM_FINAL.md` (non-ADR decision docs — not yet promoted to
  a formal ADR).
- **Translation Provider architecture** — `src/lib/translation/`:
  `types.ts` defines the `MachineTranslationProvider` interface;
  `TranslationService.translateToEnglish()` runs the pipeline (normalize →
  terminology → units → acronym-protect → provider call → restore);
  `factory.ts`'s `createMachineTranslationProvider()` is the **Provider
  Factory pattern** — selects `GoogleTranslateProvider` when
  `GOOGLE_TRANSLATE_API_KEY` is set, else `NoopMachineTranslationProvider`.
  This factory pattern mirrors `StorageProviderFactory`'s existing
  convention — reuse it as the template for any future swappable-backend
  need rather than inventing a new pattern.
- **Full architecture reference**: `docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`
  is the current source of truth. `docs/ARCHITECTURE.md` is stale
  (Sprint-1-era snapshot) — do not use it.
- **ADR index**: `docs/adr/README.md`, 33 ADRs (ADR-001–ADR-038, with
  gaps 015/016/019/020 explicitly reserved/unwritten).

---

## Operations

- **Environment variables**: see `.env.example` for the full list
  (Supabase URL/keys, `SESSION_SECRET`, Google Drive OAuth2 creds,
  `RESEND_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`, warranty-month overrides,
  password-policy overrides). Four vars used in code are currently missing
  from `.env.example` — see Technical Debt (Low). Never enter a real
  credential value into any command, field, or file — see root `CLAUDE.md`
  §3 and `.claude/rules/03-data-access-security.md` for the exact,
  narrow carve-outs.
- **Google Cloud Translation API**: optional. Unset → app runs normally
  with "Translation unavailable" fallback, PDF generation unaffected. Set
  → `GoogleTranslateProvider` activates automatically via the factory, no
  code change needed.
- **Supabase**: Postgres 17, project `lhlzzxjayywqhqtjzfiu`, region
  ap-northeast-2. RLS enabled on every table; always cross-check with
  `list_tables` before assuming schema — the DB is the source of truth,
  not memory of past sessions.
- **Storage**: Google Drive (OAuth2, legacy path) and Supabase/Cloudflare
  R2 (current Storage Platform path) — see Architecture, above.
- **Deployment**: Vercel, team `MSEAL`, Hobby plan, auto-deploy on push to
  `main`. Use `vercel deploy` (no `--prod`) for feature-branch Preview
  deployments. Full procedure: `docs/deployment/DEPLOYMENT_GUIDE.md`.
- **Backups**: Supabase-managed automatic backups/PITR (dashboard-level,
  retention depends on plan tier) — **no custom backup job exists in this
  codebase**. Google Drive files rely on Drive's own trash/versioning, no
  app-level backup.
- **Recovery**: soft-delete flip for accidental record deletion; PITR for
  DB-level recovery; see `docs/operations/OPERATIONS_RUNBOOK.md` for
  symptom-specific runbook entries (SESSION_SECRET rotation, Google OAuth
  token expiry, Tractor-IN sheet sync staleness). No DR restore has been
  drilled/verified as of this snapshot — noted as an operational risk.
- **Smoke Test**: `docs/releases/SMOKE_TEST_CHECKLIST_CORPORATE_PDF_v1.0.md`
  is the current manual production verification script (Authentication,
  MQR, Images, Translation, PDF sections). Requires a real browser and
  authenticated session — not executable by an AI agent.

---

## Do Not Do

The following require their own explicit plan/approval before any work
starts — do not begin implementation speculatively:

- **Translation Memory** — not scheduled, no plan.
- **AI-assisted translation learning/review** — not scheduled, no plan.
- **Glossary Management UI** — not scheduled, no plan.
- **Translation Review / Translation Approval workflows** — not scheduled,
  no plan.
- **Parts Translation, EPC Translation, Warranty Translation** — not
  scheduled, no plan. (Collectively, the above are the "Engineering
  Language Platform" — future roadmap ideas only, explicitly excluded from
  PR #78's scope.)
- **Platform redesign** of any Frozen Foundation layer (Attachment
  Platform, Storage Platform, DealerBranchScope, Historical Import
  Framework) — these are feature-frozen; bug/security/performance fixes
  only, per `docs/releases/MASP_PLATFORM_FOUNDATION_V1.1.md`.
- **Large/speculative refactors** — e.g. do not start decomposing `db.ts`
  without a scoped plan reviewed first, even though it's flagged as
  High-priority tech debt above. Flagging debt is not the same as
  authorization to fix it immediately.
- **Implementing Issue #79 or #80** — both are scoped and open, but neither
  has been approved for implementation. Do not start either without
  explicit instruction naming that specific issue.

---

## Next Milestone

**v2.4** (planned, not started — see `docs/ROADMAP.md` for full detail).

- **Priority 1** — Issue #79: Platform Image Management.
- **Priority 2** — Issue #80: Placeholder-based terminology preservation.

No implementation has begun on either item. Each requires its own plan and
approval before work starts, same discipline as every other milestone.

---

## AI Handoff

Read this section before making any change, not just before starting v2.4.

**Current architecture assumptions**
- No Supabase Auth — sessions are custom JWTs (`jose`), verified in both
  `lib/auth.ts` and `middleware.ts`.
- Every table has RLS **and** must be filtered through `applyScope()`/
  `dealerBranchScope.ts` in application code — both layers, always, for
  any new table.
- Attachment Platform, Storage Platform, DealerBranchScope, and Historical
  Import Framework are **frozen** — reuse them, never build a parallel
  implementation.
- `modules/`, root-level `shared/`, `templates/` are empty scaffolding —
  don't assume code lives there; everything real is under `src/`.

**Repository conventions**
- Kebab-case files, PascalCase components/types, camelCase functions.
- Server Components by default under `(app)/`; `'use client'` only on the
  smallest interactive subtree.
- Tailwind only, mobile-first, reuse `globals.css`'s `.card`/`.btn-*`
  classes rather than inventing parallel ones.
- SweetAlert2 (`lib/swal.ts`) is the only UI feedback mechanism — no
  `alert()`, no inline banners.
- All timestamps shown to a user go through `formatThaiDateTime()`
  (`lib/thaiDate.ts`) — never format a `Date` directly for display.

**Coding standards**
- TypeScript, no implicit `any`. Extend `types.ts` interfaces rather than
  re-declaring shapes inline.
- No new dependency (state library, icon library, ORM, validation library)
  added casually — it's a documented, deliberate decision (see
  `docs/ROADMAP.md` open items).
- No `TODO`, no fake/placeholder data unless explicitly requested, no
  incomplete implementations.

**Review expectations / Definition of Done**
- `npm run lint`, `npm run typecheck` (or `tsc --noEmit`), `npm run build`,
  and the architecture check must all pass before any PR is considered
  ready — every time, not just once.
- Live-verify user-facing changes on an actual deployed Preview/production
  URL — a clean build is not proof a feature works.
- Files changed / architecture impact / API impact / database impact /
  breaking changes / build/lint/typecheck status / commit SHA — report all
  of these after every completed issue, then stop for review. Never start
  the next issue automatically.

**Rules for avoiding scope creep**
- One issue = one branch, one logical change. Don't mix dependency
  updates, refactoring, features, and formatting in the same branch/commit.
- Never modify files outside the approved issue's scope — if more files
  become necessary, stop, explain why, and ask before expanding.
- "Flagged as technical debt" is not the same as "approved to fix now" —
  see Do Not Do, above.

**Always verify before changing architecture**
- Check `list_tables` (Supabase) before assuming a column/table exists.
- Read the actual current implementation, related types, repository,
  service, API route, and any relevant ADR before modifying a feature —
  never write code from memory of a prior session or a stale doc.
- If documentation and code disagree, the code (and DB schema) wins —
  report the mismatch, don't silently pick one.

**Never assume business terminology** — this codebase has a curated
engineering-terminology glossary (`terminologyDictionary.ts`) precisely
because ad hoc translation of tractor/service terms produces wrong or
inconsistent output; if a term isn't already in the glossary, ask rather
than guessing a translation or label.

**Prefer ADRs over undocumented decisions** — any new cross-module shared
abstraction or third-party integration should get an ADR (see the gap
flagged above for PR #78's own PDF/translation work — don't repeat it).

Stop after creating `HANDOFF.md`. Do not implement any feature. Do not
modify production code.

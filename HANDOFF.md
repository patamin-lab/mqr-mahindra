# HANDOFF.md — MSEAL DMS / MQR Engineering Handbook

This is the permanent engineering source of truth for this repository — not
a project summary, not a changelog. A new engineer or AI agent should be
able to read this document alone and continue development correctly,
without reading prior pull requests or chat history. If anything here ever
conflicts with the actual code, database schema, or an ADR, **the code
wins** — this document describes reality, it does not define it. Root
`CLAUDE.md` and `.claude/rules/*.md` remain the binding operating rules for
*how* to work in this repository; this file is *what the system is*.

Snapshot date: 2026-07-18. Baseline commit: `main` @ `641961c` (PR #78,
Corporate PDF Standardization). A Production Regression Audit performed the
same day found and fixed six defects on branch
`fix/production-regression-audit`, not yet merged — see
[§9 Production Regression History](#9-production-regression-history) for
what changed and why it isn't in production yet.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Business Rules](#3-business-rules)
4. [Module Overview](#4-module-overview)
5. [Shared Platform Components](#5-shared-platform-components)
6. [Engineering Standards](#6-engineering-standards)
7. [Testing Strategy](#7-testing-strategy)
8. [Decision Log](#8-decision-log)
9. [Production Regression History](#9-production-regression-history)
10. [Known Technical Debt](#10-known-technical-debt)
11. [Roadmap](#11-roadmap)
12. [AI Working Rules](#12-ai-working-rules)
13. [Definition of Done](#13-definition-of-done)
14. [Development Philosophy](#14-development-philosophy)
15. [Release Checklist](#15-release-checklist)
16. [Task Completion Checklist](#16-task-completion-checklist)
17. [Repository Governance](#17-repository-governance)

---

## 1. Executive Summary

**Project overview.** MSEAL DMS (application name; the module and database
are still named MQR — Market Quality Report, deliberately, see
[§8](#8-decision-log)) is Mahindra's dealer quality-incident reporting and
tractor-lifecycle platform. Dealers and technicians file quality incident
reports; central/regional admins review, filter, export, and track them via
a KPI dashboard. The platform has grown from a single MQR module into a
multi-module system covering New Tractor Registration (NTR), Preventive
Maintenance (PM), Delivery lifecycle tracking, Import Inspection (PDI), and
a unified Machine Digital Passport ("Vehicle360"). Every business report
generates a bilingual (Thai/English) PDF; vehicle master data syncs in from
a "Tractor IN" Google Sheet.

**Production status.** Live and stable at `masp-mseal.vercel.app`. No open
release blocker. Repository is public
(`github.com/patamin-lab/mqr-mahindra`), branch `main`.

**Deployment status.** Vercel auto-deploys every push to `main`; CI
(`verify` required check) is green on `main` HEAD. No automated
health-check endpoint exists (see [§10](#10-known-technical-debt)) — deploy
verification today is CI status plus manual smoke testing.

**Current release.** PR #78, "Corporate PDF Standardization," merge commit
`6ef759dd01cf5aecc37286c78dfb37c24f2b654c` (2026-07-18). Full notes:
`docs/releases/RELEASE_NOTES_CORPORATE_PDF_v1.0.md`. Predecessor: PR #77,
"Production bug fixes + list/image standardization," merge commit
`13d62c4b6e632863da902fa03218597e7a004010`. Last formal tag:
`v1.0-platform-foundation` — no tag has been cut since; recent work has
shipped as ordinary merges to `main` (tags require explicit instruction per
`.claude/rules/git.md`).

**Architecture maturity.** The platform has a declared, ADR-governed
**Frozen Foundation**: Attachment Platform (ADR-010), Storage Platform,
DealerBranchScope Authorization (ADR-013), and the Historical Import
Framework are feature-frozen — every module reuses them, none may build a
parallel implementation without a bug/security/performance justification
and, for architecture-baseline items, a full Architecture Review (see
[§2](#2-system-architecture), [§17](#17-repository-governance)). 33 ADRs
exist (`docs/adr/README.md`, next number 040); governance around them is
unusually rigorous for this project's size (a duplicate ADR number was
found and corrected by hand, and that correction is itself documented).

**Known production risks**, in priority order (see
[§10](#10-known-technical-debt) for full detail):

1. No error-tracking/observability layer (no Sentry, no structured
   logging, no health-check endpoint) — incidents are currently found by
   users, not the system.
2. Core security modules (`lib/auth.ts`, `lib/scope.ts`, `lib/db.ts`) have
   no direct automated test coverage.
3. Legacy unsalted SHA-256 password hashes persist for any account that
   hasn't logged in since the scrypt migration.
4. The large-file upload path has no server-enforced size limit and no
   MIME/magic-byte validation.
5. `GOOGLE_TRANSLATE_API_KEY` is not yet provisioned in production — a
   known, safely-degrading gap, not a defect (bilingual PDF fields show
   "Translation unavailable" until it is set).

---

## 2. System Architecture

Every business module in this repository follows the same layered flow.
This is the mandatory shape for new work, not a stylistic suggestion —
skipping a layer (e.g. a page calling Supabase directly) is a defect to
fix, not a shortcut to take.

```text
UI (Server Component page → thin Client Component for interactivity)
   ↓
API Route (src/app/api/**/route.ts)
   ↓
Service (src/features/<module>/services/*.ts, or src/lib/db.ts for MQR)
   ↓
Repository (src/features/<module>/repositories/*.ts)
   ↓
Database (Supabase Postgres, RLS + applyScope()/DealerBranchScope — both
          layers mandatory for every table)
   ↓
Storage (AttachmentService → StorageProviderFactory → Supabase/R2/Drive)
   ↓
PDF (src/lib/pdf/* shared framework, consumed by each module's PDF
     renderer)
   ↓
Translation (TranslationService → MachineTranslationProvider, consumed
             only by the PDF layer's bilingual fields)
```

**Why each layer exists, and why it may not be skipped:**

- **UI stays thin.** Pages under `(app)/` are Server Components by
  default; `'use client'` is added only to the smallest subtree that needs
  interactivity (a form, a modal). A page's job is to fetch data via the
  Service layer and render it — it must never contain business rules
  (e.g. "is this record editable," "what counts as in-warranty"). If a
  rule shows up twice in two different pages, that is a signal the rule
  leaked out of the Service layer and needs to move back down.
- **Service owns business logic.** `MaintenanceService`, `NtrService`,
  `DeliveryService`, `InspectionService`, `KnowledgeService` (and, for the
  original MQR module, `src/lib/db.ts`'s exported functions playing the
  same role) are where every business rule actually lives: warranty
  calculation triggers, status-transition rules, duplicate detection,
  audit-event emission, orchestration across multiple repositories. A
  Service method is the one place a rule like "Warranty Start must equal
  NTR Delivery Date" (see [§3](#3-business-rules)) gets enforced — never
  re-implemented at the API route or UI layer.
- **Repository owns data access *and filtering*.** Every repository's
  `list`/`getById` methods accept an optional `session: SessionUser` and
  apply Dealer/Branch Scope internally (`applyScope()` for the MQR-era
  functions in `db.ts`, or the repository's own scope-aware query
  construction for newer modules) — a caller should never have to
  remember to filter by dealer/branch itself, and a caller that *does*
  filter manually is duplicating a decision that belongs in exactly one
  place. This is why `resolveAttachmentAccess.ts`
  ([§5](#5-shared-platform-components)) dispatches to each module's own
  repository/service `getById` rather than re-implementing a second scope
  check — the Repository is the only place that check should exist.
- **Shared components are preferred over one-off implementations** at
  every layer: one `Pagination`/`ActionColumn` component, one
  `AttachmentViewer`, one `TranslationService`, one `StorageProviderFactory`
  — see [§5](#5-shared-platform-components) for the full inventory. A new
  module reaches for an existing shared component first; a genuinely new
  cross-module need becomes a new shared component, not a copy-pasted one.

**Database.** Supabase Postgres 17 (project `lhlzzxjayywqhqtjzfiu`, region
ap-northeast-2), RLS enabled on every table. Always verify current schema
via Supabase's `list_tables` before assuming a column exists — the
database is the source of truth, not this document or memory of a past
session.

**Full architecture reference**: `docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`
is current. `docs/ARCHITECTURE.md` is a stale Sprint-1-era snapshot — do
not use it. The long-term target architecture (Machine as aggregate root,
Canonical Event Catalog, Engineering Intelligence's AI Governance boundary)
is in `docs/architecture/blueprint/` and is **APPROVED and FROZEN** at the
baseline level — any change to that baseline requires an ADR, an
Architecture Review, and Architecture Approval, not a routine PR (see
`docs/architecture/blueprint/20-ARCHITECTURE-GOVERNANCE.md`).

---

## 3. Business Rules

Every rule below is enforced in code today, not aspirational. Each one was
re-traced UI→API→Service→Repository→Database during the 2026-07-18
Production Regression Audit ([§9](#9-production-regression-history)); the
citations are current as of that trace.

### Warranty Start Date

> **Warranty Start Date = NTR Delivery Date (Customer Delivery Date).**
> Never Manufacturing Date, Registration Date, record-creation timestamp,
> or the current date.

- Single source: `vehicles.delivery_date`, written only by
  `updateVehicleDeliveryInfo()` (`src/lib/db.ts`), called only from
  `runNtrWarrantyOrchestration()` (`src/features/ntr/services/ntrPostCreateOrchestration.ts`),
  sourced from `ntr_records.delivery_date` — never from the legacy
  `retail_date` column, which the current manual NTR form always leaves
  `null`.
- `calcWarranty()` (`src/lib/warranty.ts`) only ever consumes the date
  arguments it's given — it has no internal date source of its own.
  Verified across all 7 call sites (MQR create/edit, NTR detail/PDF/Excel,
  Machine Passport): every one resolves to `vehicles.delivery_date`.
- Warranty End Date = `calcWarranty()`'s start-date argument plus the
  configured limit (48 months powertrain / 24 months general, currently
  hardcoded in `warranty.ts`; see [§10](#10-known-technical-debt) for the
  one latent risk here — an unused env-var override path in
  `businessConfig.ts` that only the NTR list filter honors).
- Delivery's own Vehicle Timeline `WARRANTY_ACTIVATED` event is
  deliberately dated to `deliveryDate`, **never** `warrantyActivatedAt`
  (the processing timestamp) — this exact distinction is regression-tested
  (`src/features/delivery/service.test.ts`).
- PM has no warranty logic at all (not a gap — PM simply doesn't expose
  warranty status).

### Operational Product Visibility

> Operational modules show only configured **Active** products/taxonomy
> entries. Master Data management screens may show all records, including
> inactive ones.

No single "Active Product" flag spans the whole schema; the closest real
concept is an `active` boolean on each per-domain master table:
`product_families.active`, `problem_codes.active`, `pm_intervals.active`.
The established, consistent pattern is a pair of accessor functions per
table in `src/lib/db.ts`: `listActiveX()` (operational reads — MQR's
problem-code dropdown, PM's interval picker, Knowledge's product-family
picker) vs. `listAllXAdmin()` (admin CRUD screens only). `vehicles` itself
has no active/status column — Vehicle360's model search intentionally
browses already-delivered inventory (which must stay searchable even for a
discontinued model), not a product catalog, so it has no active-filtered
counterpart by design, not by omission.

### Authorization

> Dealer role → own dealer/branch only. Admin roles → all dealers. Super
> Admin → unrestricted.

The actual RBAC model has **four** roles, not three — `DealerUser` is
further pinned to their own branch (a service branch is a team, not an
individual), which the simplified "Dealer/Admin/SuperAdmin" framing above
doesn't capture on its own:

| Role | Scope |
| --- | --- |
| `SuperAdmin` | Unrestricted — every dealer, every branch, exclusive access to hard-delete of `users` and SuperAdmin creation. |
| `CentralAdmin` | All dealers (`seesAllDealers(role) === true`), no SuperAdmin-only actions. |
| `DealerAdmin` | Own dealer only, every branch within it. |
| `DealerUser` | Own dealer **and** own branch only — every record in their branch, not just records they personally created. |

Enforced two ways, both mandatory for every table (never one alone):
Postgres RLS, **and** application-level `applyScope()`/`DealerBranchScope`
(`src/lib/scope.ts` for role predicates, `src/lib/dealerBranchScope.ts` for
the dealer/branch resolution itself — see
[§5](#5-shared-platform-components)). See ADR-013.

---

## 4. Module Overview

### MQR (Quality Report)
- **Purpose**: the original module — dealer-filed quality incident reports
  (serial, problem code/severity, photos/video, GPS, root cause, parts,
  repair outcome, PDF + email).
- **Responsibilities**: report CRUD, status workflow (Draft → Open →
  UnderInvestigation → WaitingParts → Repaired → Closed), soft delete,
  export (PDF/Excel/CSV), dashboard KPIs.
- **Dependencies**: Attachment Platform (photos/video), Storage Platform,
  Shared PDF Framework, Translation, `vehicles` (serial lookup), Dealer/
  Branch Scope.
- **Current status**: production, stable. Still the only module whose
  data-access layer is a flat set of `src/lib/db.ts` exported functions
  rather than a `Repository`/`Service` class pair — historical, not a
  defect, but the reason `db.ts` has grown to 2,807 lines
  ([§10](#10-known-technical-debt)).
- **Known limitations**: input validation is manual/ad hoc (`String()`/
  regex in the API route) rather than the zod-schema pattern NTR/PM use.

### NTR (New Tractor Registration)
- **Purpose**: registers a tractor's delivery to a customer — the event
  that establishes `vehicles.delivery_date`/`dealer_id`/`branch_id` and
  triggers Warranty Activation.
- **Responsibilities**: one dual-mode create/edit form ("One Form, Dual
  Mode," Production Pilot Readiness / ADR-035–037), duplicate-NTR
  prevention, warranty orchestration trigger, Activity Timeline.
- **Dependencies**: `vehicles` (writes `delivery_date`/`dealer_id`/
  `branch_id` once, then Tractor IN sync must never overwrite it again —
  ADR-037), Delivery module (`activateWarrantyFromNtr`), Attachment
  Platform, Shared PDF Framework, Translation.
- **Current status**: production, stable.
- **Known limitations**: the list/export "Delivery Date" search filter was
  found querying the wrong column during the 2026-07-18 audit — fixed on
  `fix/production-regression-audit`, not yet merged
  ([§9](#9-production-regression-history)).

### PM (Preventive Maintenance)
- **Purpose**: scheduled maintenance records against a vehicle's interval
  program (hours/months-based), independent of warranty status.
- **Responsibilities**: record CRUD, locking (a superseded PM record can be
  locked, SuperAdmin-only unlock with mandatory reason), interval
  resolution from `pm_intervals`/Product Family assignment, PDF/Excel
  export, history search/filter.
- **Dependencies**: `product_families`/`pm_intervals` (active-filtered),
  `vehicles`, Attachment Platform, Shared PDF Framework, Translation.
- **Current status**: production, stable. Fully migrated to the
  `Repository`/`Service` pattern (`SupabaseMaintenanceRepository`/
  `MaintenanceService`) — the reference implementation for how a module
  *should* be structured.
- **Known limitations**: no warranty logic (by design). Upload-time image
  processing (EXIF-upright, orientation) is not wired in for this module —
  tracked as part of Issue #79.

### Warranty
- **Purpose**: not a standalone module — a cross-cutting calculation
  (`calcWarranty()`, `src/lib/warranty.ts`) consumed by MQR, NTR, and
  Machine Passport, plus a lifecycle event owned by Delivery
  (`activateWarrantyFromNtr()`).
- **Responsibilities**: compute in/out-of-warranty status and remaining
  months from a delivery date, a found/as-of date, and a
  powertrain-vs-general classification. See
  [§3](#3-business-rules) for the full rule.
- **Dependencies**: `vehicles.delivery_date` only — never independently
  stored or recomputed from another source.
- **Current status**: production, correct, verified end-to-end
  2026-07-18.
- **Known limitations**: hardcodes 24/48 months rather than reading
  `businessConfig.ts`'s env-var override, which only the NTR list filter
  honors — a latent two-sources-of-truth risk if that env var is ever set
  ([§10](#10-known-technical-debt)).

### Delivery
- **Purpose**: tracks the full physical delivery lifecycle of a tractor —
  Stock Yard receipt, Import Inspection link, Dealer Preparation, Customer
  Delivery (linked NTR), Operator Training, Delivery Acceptance — and owns
  Warranty Activation as a real point-in-time event.
- **Responsibilities**: stage-gated state machine (`DeliveryService`),
  Vehicle Timeline event publishing, cross-module linking (NTR, Import
  Inspection) with server-side re-verification of what the client claims
  (e.g. "does this NTR's serial actually match this delivery record").
- **Dependencies**: NTR (linkage), Inspection/PDI (linkage), Vehicle
  Timeline (`vehicle-event` feature), Dealer/Branch Scope (dealer-only
  comparison — `DeliveryRecord` has no `branch_id`).
- **Current status**: production, stable (ADR-017/027/028).
- **Known limitations**: its non-existent-id error handling returned HTTP
  400 instead of 404 across all six stage-action routes — fixed on
  `fix/production-regression-audit`, not yet merged. Two Machine
  Passport/Delivery-detail UI panels labeled a processing timestamp
  (`warrantyActivatedAt`) in a way that could be misread as the warranty
  start date — also fixed on that branch (label-only change, no data/logic
  change). See [§9](#9-production-regression-history).

### PDI (Import Inspection)
- **Purpose**: MSEAL-internal (never dealer-visible in detail — ADR-028)
  pre-delivery quality inspection of an imported unit, one stage inside
  the Delivery lifecycle.
- **Responsibilities**: checklist, findings, measurements, parts-replaced
  tracking, factory feedback loop, RE-PDI chaining, Release to Dealer.
- **Dependencies**: `assertMsealAccess`/`canAccessImportInspection`
  (`src/lib/scope.ts`) gates every detail-level read — a `DealerUser` may
  never see PDI detail even for their own dealer's vehicle, only that an
  inspection occurred (via Machine Passport's summary-only read path).
- **Current status**: production, stable.
- **Known limitations**: its list page has no pagination (pre-existing,
  disclosed gap from PR #77, not a regression).

### Vehicle360 (Machine Digital Passport)
- **Purpose**: the single per-serial destination — Identity, Ownership,
  Lifecycle, Warranty, PM, Quality, Delivery, Documents, Activity, Related
  Records — consolidating what used to be a separate `/vehicles/[serial]`
  page (now a redirect, ADR-030).
- **Responsibilities**: read-only aggregation across MQR/PM/NTR/Delivery/
  Inspection/Knowledge via `MachineService`; owns no data of its own.
- **Dependencies**: every other module's Service layer (read-only), each
  section wrapped in independent failure isolation (`safe()` helper, route
  Error Boundaries) so one module's failure never blanks the whole page —
  a hardening pass from PR #77.
- **Current status**: production, stable.
- **Known limitations**: the Warranty panel shows computed status/age but
  not the raw start/end dates (a completeness gap, not a correctness
  defect — noted, not scheduled).

### Authentication
- **Purpose**: custom (no Supabase Auth) session management.
- **Responsibilities**: SHA-256-legacy/scrypt password verification with
  silent upgrade-on-login, JWT session signing/verification (`jose`),
  revocable device-aware `user_sessions`, CSRF header enforcement, account
  lockout/rate limiting, self-service password reset/change, forced
  first-login change.
- **Dependencies**: `SESSION_SECRET`, `middleware.ts` (every request path
  except a short public-path allowlist).
- **Current status**: production, stable, verified defect-free in the
  2026-07-18 audit (session revocation fails closed on any lookup error).
- **Known limitations**: unsalted legacy SHA-256 hashes persist
  indefinitely for dormant accounts ([§10](#10-known-technical-debt)).

### Authorization
- **Purpose**: the RBAC + Dealer/Branch Scope model described in
  [§3](#3-business-rules).
- **Responsibilities**: role predicates (`lib/scope.ts`), dealer/branch
  resolution and single-record access checks (`lib/dealerBranchScope.ts`).
- **Dependencies**: every module's Repository/Service layer, every API
  route.
- **Current status**: production, stable, and the single most rigorously
  enforced layer in the codebase — with one confirmed, now-fixed exception
  ([§9](#9-production-regression-history)): the Attachment Platform had no
  scope check at all until the 2026-07-18 audit.

### Translation
- **Purpose**: bilingual (Thai source / English translation) rendering for
  PDF free-text fields.
- **Responsibilities**: `TranslationService.translateToEnglish()` pipeline
  — normalize → terminology substitution → unit normalization → acronym
  protection → provider call → placeholder restore. Never blocks PDF
  generation on failure.
- **Dependencies**: `MachineTranslationProvider` interface, selected by
  `createMachineTranslationProvider()` factory —
  `GoogleTranslateProvider` when `GOOGLE_TRANSLATE_API_KEY` is set, else
  `NoopMachineTranslationProvider`.
- **Current status**: production, correct — pipeline ordering was
  corrected during PR #78's own stabilization pass (terminology must
  substitute into the Thai *source*, never post-process the provider's
  English output — a real bug, self-found before shipping, see
  [§9](#9-production-regression-history)).
- **Known limitations**: terminology injection is mixed-language splicing,
  not the placeholder-token pattern acronym protection already uses —
  tracked as Issue #80, explicitly not a defect in the shipped pipeline.

### PDF
- **Purpose**: one shared framework generating every business document
  (MQR/NTR/PM) as a bilingual, branded, QR-coded PDF.
- **Responsibilities**: `src/lib/pdf/` — headers/footers, document
  metadata, filename convention, font registration, image
  fetch-with-fallback, fresh signed-URL resolution, `BilingualField`.
- **Dependencies**: Attachment Platform (`AttachmentService.getUrl()` for
  every image, resolved fresh at render time — never a stale persisted
  URL), Translation.
- **Current status**: production, stable, verified defect-free end-to-end
  in the 2026-07-18 audit.
- **Known limitations**: no ADR exists for this framework
  ([§10](#10-known-technical-debt)). No caching on translation calls —
  every export re-calls the provider per field.

### Storage
- **Purpose**: the Attachment Platform — one storage abstraction for every
  module's photos/video/documents.
- **Responsibilities**: `Business Module → AttachmentService →
  AttachmentRepository → StorageProviderFactory → Supabase/Cloudflare R2`
  (or Google Drive for the legacy archive tier). Archive lifecycle
  (ACTIVE → ARCHIVE_PENDING → ARCHIVING → ARCHIVED) with checksum
  verification before any source deletion.
- **Dependencies**: none — this is a foundation layer everything else
  depends on.
- **Current status**: production, stable, **frozen** (ADR-010) — bug/
  security/performance fixes only. One Critical defect found and fixed
  2026-07-18: no dealer/branch scope check on read/delete/reassign —
  see [§9](#9-production-regression-history).
- **Known limitations**: large-file upload path has no server-enforced
  size limit and no MIME/magic-byte validation
  ([§10](#10-known-technical-debt)).

---

## 5. Shared Platform Components

Every item below exists to be reused, not re-implemented. Building a
second version of any of these for a new module is a defect against
[§6](#6-engineering-standards)'s "no duplicated business logic" rule, not
a legitimate design choice, unless a documented ADR says otherwise.

| Component | Location | Owns | Reused by |
| --- | --- | --- | --- |
| **Shared PDF Framework** | `src/lib/pdf/` | Header/footer/metadata/filename/style/font/image-resolution for every generated document | MQR, NTR, PM PDF renderers |
| **Shared Image Platform** | `src/components/shared/image/` (`ImageItem`, `ImageThumbnail`, `ImagePreview`, `ImageViewer`, `AttachmentResourceProvider`) | Shared image identity, thumbnail/preview/viewer state, transforms, signed-resource cache/retry | MQR, NTR, PM, Delivery/PDI, Vehicle360/Machine Passport |
| **Attachment Upload Tile** | `src/components/shared/attachments/AttachmentPhotoTile.tsx` | Shared upload-slot shell with `ImageItem` preview path and legacy URL fallback | NTR, PM |
| **Legacy Attachment Viewer** | `src/components/shared/attachments/AttachmentViewer.tsx` | Compatibility image/document viewer for not-yet-migrated consumers | Knowledge |
| **Activity Timeline** | `src/components/shared/activity-timeline/` | Generic, category-agnostic event timeline | Quality Reports today; designed for PM/NTR/Warranty/ORC to plug in without redesign |
| **Authorization Scope** | `src/lib/scope.ts` + `src/lib/dealerBranchScope.ts` | Role predicates and dealer/branch resolution/access checks | Every module's Repository/Service and every API route |
| **Translation Provider** | `src/lib/translation/` | The `MachineTranslationProvider` interface + factory | PDF layer's `BilingualField` only |
| **Repository Layer** | `src/features/<module>/repositories/*.ts` (MQR: `src/lib/db.ts`) | Data access **and** scope filtering for its own module's tables | That module's Service layer only — never called directly from a route or page |
| **Storage Layer** | `src/shared/attachments/` (`AttachmentService`, `AttachmentRepository`, `StorageProviderFactory`) | File storage abstraction, archive lifecycle | Every module via `AttachmentService` — never a raw provider SDK call from business code |

**Ownership model**: each component has exactly one home directory and one
maintainer concern (e.g. `lib/pdf/` owns document layout, `lib/translation/`
owns language — a PDF bug is never fixed by patching translation code and
vice versa). New consumers add a call site; they do not fork the
component. If a component's contract genuinely doesn't fit a new use case,
that is a design conversation (extend the interface, add a parameter) —
not a reason to copy the file.

---

## 6. Engineering Standards

- **TypeScript strict mode** is on (`tsconfig.json`: `"strict": true`) —
  no implicit `any`. Extend the interfaces in `lib/types.ts` (or each
  module's own `types.ts`) rather than re-declaring shapes inline.
- **No duplicated business logic.** A rule (warranty calculation, a status
  transition, a scope check) lives in exactly one Service/Repository
  function. If you find yourself writing the same `if` twice, one of them
  is wrong.
- **Shared components first.** Check [§5](#5-shared-platform-components)
  and the existing `components/shared/`/`features/*/components/` tree
  before writing a new one.
- **UI remains thin** — see [§2](#2-system-architecture).
- **Repository owns filtering; Service owns business logic** — see
  [§2](#2-system-architecture). This split is what makes
  [§5](#5-shared-platform-components)'s `resolveAttachmentAccess.ts`
  pattern possible: a new caller gets correct scope for free by calling
  the existing Repository method, never by re-deriving the rule.
- **Small pull requests, one issue per branch.** `feature/<issue-name>`;
  no mixing dependency updates, refactoring, features, and formatting in
  one commit series.
- **Minimal, safe changes.** Prefer the smallest diff that correctly fixes
  the root cause over a broader rewrite — see the six fixes in
  [§9](#9-production-regression-history) as the standard to match (each
  touched only the files the defect actually lived in).
- **Regression tests are required** for every fixed defect, added in the
  same PR, asserting the actual failure mode (not just "the function
  runs") — see [§7](#7-testing-strategy).
- No `TODO`, no fake/placeholder data unless explicitly requested, no
  incomplete implementations, no `console.log` left in committed code.
- No new dependency (state library, icon library, ORM, validation library)
  added casually — this codebase has none of these today, and that's a
  documented, intentional gap (see `docs/ROADMAP.md` open items), not an
  oversight to "fix" unilaterally.

---

## 7. Testing Strategy

Every one of the following must pass before a PR is considered ready —
every time, not just once, and not skipped because a change "looks safe":

| Gate | Command | What it catches |
| --- | --- | --- |
| **Architecture Check** | `npm run architecture` | Layer-boundary violations — e.g. a business module deep-importing a platform internal instead of its barrel export (this exact check caught a real violation during the 2026-07-18 audit's own fix, see [§9](#9-production-regression-history)) |
| **Typecheck** | `tsc --noEmit` | Type errors, `strict` mode violations |
| **Lint** | `next lint` | Code-quality rules, accessibility (`jsx-a11y`), Next.js-specific patterns |
| **Tests** | `vitest run` | Unit/service-layer regressions — 793 tests across 94 files as of this snapshot |
| **Build** | `next build` | Production compile correctness, every route resolves |
| **Regression Testing** | (part of `vitest run`) | Every fixed defect gets a dedicated test asserting the specific failure mode, not a generic smoke test |
| **Manual Production Verification** | `docs/releases/SMOKE_TEST_CHECKLIST_*.md` per release | User-facing correctness a build/typecheck cannot catch — requires a real browser and authenticated session, not executable by an AI agent |

**On the Windows/PowerShell environment quirk**: this repository's working
directory path contains an `&` (`...Mahindra & Mahindra Ltd...`), which
breaks `npm.cmd`/`.cmd` shim invocation under both Git Bash and
`cmd.exe`-backed PowerShell (the ampersand is interpreted as a command
separator partway through the path). Work around it by invoking the
underlying JS entrypoint directly via `node`, e.g.:
```powershell
$cli = Resolve-Path "node_modules\tsx\dist\cli.mjs"; node "$cli" scripts/architecture-check.ts
```
This is an environment workaround, not a project convention — do not
"fix" it by changing the repository's own scripts.

**Coverage gap, not a testing-strategy gap**: there is no coverage
threshold configured (`vitest.config.ts` has no `coverage` block) and
several critical modules have no direct test file — see
[§10](#10-known-technical-debt).

---

## 8. Decision Log

Architectural intent, not just what shipped — read this before proposing
to change any of the following.

- **Why Repository owns filtering, not the API route or UI.** A scope
  check written once, in the Repository, is checked by construction every
  time that Repository method is called — including by code written
  later, by someone who never read this document. A scope check
  duplicated at each call site is one that *will* eventually be forgotten
  at a new call site; this is exactly what happened to the Attachment
  Platform (no Repository-level owner of scope existed for it, because
  attachments deliberately have no `dealer_id` of their own — see
  [§9](#9-production-regression-history)'s Critical finding). ADR-013
  formalizes this as "Authorization decisions stay out of the data-access
  layer's *raw* query construction, but the *check itself* is the
  Repository/Service's job, not the caller's."
- **Why Translation uses a provider abstraction.** `MachineTranslationProvider`
  is a one-method interface so the concrete translation backend (Google
  Cloud Translation today) is swappable without touching
  `TranslationService`'s pipeline logic — the same reasoning as
  `StorageProviderFactory` for file storage. This also makes the "no
  configured API key" case a first-class, tested path (`NoopMachineTranslationProvider`)
  rather than an exception handler bolted onto one concrete
  implementation.
- **Why the shared PDF framework exists.** Before PR #78, MQR/NTR/PM each
  had their own independently-drifting header/footer/style implementation
  — a change to the brand header meant three edits, and they had already
  drifted (inconsistent metadata, one module missing document Title/
  Author). Consolidating into `src/lib/pdf/` makes "every PDF looks and
  behaves the same" a property of the shared code, not a discipline every
  module has to independently maintain.
- **Why Google Cloud Translation was selected.** A plain REST `fetch()`
  call against the Cloud Translation v2 API, chosen specifically to avoid
  adding a new npm dependency (consistent with [§6](#6-engineering-standards)'s
  "no casual new dependency" rule) while still getting a real, production-
  grade MT engine rather than a hand-rolled dictionary-only translator.
- **Why Translation Memory was postponed.** PR #78's scope was explicitly
  "make bilingual PDFs correct and safe to ship," not "build a translation
  management platform." Translation Memory, review/approval workflows, and
  a glossary management UI are all real future value, but each is its own
  multi-week scope with its own data model and UX — bundling any of them
  into PR #78 would have both delayed the shipped fix and expanded scope
  well past what was reviewed. They remain roadmap ideas only (see
  [§11](#11-roadmap)).
- **Why Placeholder Translation became technical debt (Issue #80), not a
  PR #78 blocker.** The shipped pipeline (splice the approved English term
  directly into the Thai sentence before translation) is *correct* —
  verified output matches the glossary. The placeholder-token approach
  (matching how acronym protection already works) is a **better**
  implementation of the same correct behavior, not a bug fix — so it was
  filed as a scoped, documented improvement rather than blocking the
  release it was found alongside.
- **Why Vehicle360 reuses shared components rather than building its own
  view of each module.** Machine Passport (ADR-026) is explicitly a
  read-only aggregation layer — it owns no data. Every section
  (`MachineWarrantySection`, `MachineDeliveryPanel`, etc.) calls the
  owning module's own Service layer and renders the same shared
  `AttachmentViewer`/`ActivityTimeline`/etc. components used elsewhere.
  This is why Vehicle 360 Consolidation (ADR-030) could retire the old
  separate `/vehicles/[serial]` page as a pure redirect — there was never
  a second, parallel data path to reconcile.
- **Why the module is still named "MQR" and the app is branded "MSEAL
  DMS."** Platform Branding replaced *user-facing* MASP/"Market Quality
  Report" branding with "MSEAL DMS" everywhere it represents the
  application (login, shell, nav, emails) — but the MQR module name,
  `records`/`job_id` schema, API routes, and business document titles were
  deliberately left unchanged, since renaming a live database schema/API
  surface for a branding change alone is exactly the kind of
  disproportionate, non-root-cause change this repository's standards
  reject (see [§14](#14-development-philosophy)).

---

## 9. Production Regression History

Chronological, most recent first. "Unresolved" entries are still open.

### 2026-07-18 — Production Regression Audit (branch `fix/production-regression-audit`, **not yet merged**)

A full audit was performed across every module (functional CRUD/search/
pagination, the Warranty and Product-Visibility business rules,
Authorization, and the PDF/Image/Translation pipeline). Six confirmed
production defects, grouped into five defect classes below, were fixed with
regression tests; the current branch verification suite passed in full
(814/814 tests; typecheck, architecture, lint, and build all passed).
**These fixes are not yet in production** — they exist only
on the audit branch pending review and merge.

| Severity | Module | Symptom | Root Cause | Resolution | Regression Prevention |
| --- | --- | --- | --- | --- | --- |
| Critical | Attachments (all modules) | Any authenticated DealerUser could read/delete another dealer's attachment by ID, or list another dealer's attachments via a guessable `entityId` | The `attachments` table has no `dealer_id`/`branch_id`; the three exposed routes checked only `if (!session)`, never re-resolving the owning record's scope | New `resolveAttachmentAccess.ts` dispatches to each module's own scope-safe Repository/Service accessor before serving/deleting/reassigning | Dedicated resolver unit tests in `src/shared/attachments/__tests__/resolveAttachmentAccess.test.ts`, plus consuming-route coverage |
| High | NTR | List/export "Delivery Date" search filter always returned zero rows | Filtered the legacy `retail_date` column (always `null` on modern records) instead of `delivery_date` | `supabaseNtrRepository.ts` now filters `delivery_date` | New test asserting the query builder never receives `retail_date` |
| High | Admin (Dealers/Problem Codes/PM Intervals/Product Families) | `PATCH` on a non-existent id returned an opaque HTTP 500 | No existence pre-check; Supabase's `PGRST116` (0 rows) fell into the generic 500 catch | Catch blocks now map `PGRST116` → 404 | New test on the Dealers route pinning the shared pattern |
| Medium | Delivery (all six stage-action routes) | `POST` on a non-existent delivery id returned HTTP 400 | Generic catch defaulted anything that wasn't a recognized "forbidden" message to 400 | Catch blocks now detect the "not found" message and return 404 | New test added to all six existing route test files |
| Medium | Delivery / Machine Passport | Two UI panels labeled `warrantyActivatedAt` (a processing timestamp) as if it were the warranty start date | Correct underlying data, misleading label/value pairing | Relabeled to "Warranty Activation Logged At" / Thai equivalent — no data or logic change | Copy-only change; no dedicated test (nothing to assert beyond the label string) |

**Business rule verification performed in the same pass** (no code change
required — all PASS): Warranty Start = NTR Delivery Date across every
consuming module; Operational Product Visibility filtering; the PDF/Image/
Translation pipeline fixes from PR #78 confirmed intact.

### PR #78 — Corporate PDF Standardization (2026-07-18, merged `6ef759d`)

| Module | Symptom | Root Cause | Resolution |
| --- | --- | --- | --- |
| PDF (all modules) | Photos silently missing from generated PDFs | None of the three export routes refreshed a record's signed URLs before rendering — any photo older than its signed URL's TTL 403'd and vanished with no trace | Every renderer now calls `AttachmentService.getUrl()` fresh, immediately before rendering |
| PDF (MQR, PM) | Photos cropped to fill a fixed box | `objectFit: 'cover'` on the photo style | Changed to `contain` (letterboxed, never cropped), matching NTR's already-correct pattern |
| Translation | Terminology/unit glossary was a silent no-op against a real translator | Terminology substitution was applied to the *provider's output* (post-processing), which only looked correct against hand-written test fixtures with artificial Thai substrings left in "translated" text | Pipeline reordered to substitute terminology/units into the Thai *source* before the provider call — self-found during PR #78's own stabilization review, not a user-reported defect |

### PR #77 — Production bug fixes + list/image standardization (2026-07-17, merged `13d62c4`)

| Module | Symptom | Root Cause | Resolution |
| --- | --- | --- | --- |
| PM | View/Edit pages showed a generic error instead of the record | `fetchMaintenance.ts` did a server-to-server self-HTTP-fetch back into its own API route instead of calling the Service layer directly — any cookie-forwarding hiccup or transient error rendered the fallback `EmptyState` | Pages now call `MaintenanceService.getById()` directly, mirroring NTR's existing pattern |
| NTR | Previously-uploaded photos stopped displaying after ~1 hour | NTR was the sole module building its photo gallery straight from persisted `_url` columns without resolving a fresh signed URL first | `resolveNtrAttachmentUrls()` added, mirroring PM's already-working pattern |
| Vehicle360 | Dealer didn't update after an NTR registration | `updateVehicleDeliveryInfo()` wrote only `delivery_date`/`product_family_id`, never `dealer_id`/`branch_id`, so once Tractor IN sync froze `dealer_id` (post-ADR-037) nothing ever wrote the real dealer | Extended the same write call to also set `dealer_id`/`branch_id` |
| NTR/MQR (cross-module) | NTR's own PDF/Excel/detail page showed "delivery date not specified" while MQR/Vehicle360 for the same serial showed the correct status | Three call sites computed warranty from the legacy `retail_date` field, which the current manual NTR form always leaves `null` | Changed all three to `delivery_date` |
| Machine Passport | Intermittent full-page server exception | No Error Boundary existed anywhere under `src/app`; any one of ~15 independent Supabase calls per page load throwing would crash the whole page | Added route-segment and root Error Boundaries; wrapped every `MachineService` method call in per-section failure isolation (`Promise.allSettled` + `safe()` helper) so one failing section degrades independently |

### Unresolved / not yet scheduled for a fix

- Every item in [§10](#10-known-technical-debt) is, by definition, known
  and not yet fixed.

---

## 10. Known Technical Debt

Distinct from the bugs in [§9](#9-production-regression-history) — nothing
below is presently causing incorrect behavior in production; each is a
maintainability, coverage, or hardening gap.

**High priority**
- **No automated test coverage on `lib/auth.ts`, `lib/scope.ts`,
  `lib/db.ts`.** Impact: a regression in any of these is a security
  incident with no automated safety net. Recommendation: add direct unit
  tests before either file is next touched for any reason.
- **Unsalted legacy SHA-256 password hashes** persist indefinitely for any
  account that hasn't logged in since the scrypt migration (silent
  upgrade-on-login only covers active users). Impact: a real, unbounded
  exposure window for dormant accounts. Recommendation: a one-time forced
  reset for accounts still on the legacy hash past a cutoff date.
- **No server-enforced upload size limit or MIME/magic-byte validation**
  on the large-file path (`createSignedUploadUrl` passes no
  `fileSizeLimit`; client-supplied MIME type is trusted). Impact: relies
  entirely on unmanaged Supabase dashboard bucket config. Recommendation:
  pass an explicit size limit and add a magic-byte check before accepting
  a file as an image.
- **No error-tracking/observability layer** — no Sentry, no structured
  logging, no health-check endpoint. Impact: production incidents are
  currently found by users, not the system. Recommendation: this is the
  single highest-leverage operational investment available; even a
  minimal Sentry integration would materially change incident
  detection time.

**Medium priority**
- **`src/lib/db.ts` decomposition** — 2,807 lines, 85 exports, mixing
  MQR/NTR/PM/vehicle/master-data/audit concerns in one module. Impact:
  every touch risks an unrelated regression. Recommendation: a scoped
  decomposition *plan*, reviewed before any decomposition work starts —
  not an emergency rewrite (see [§14](#14-development-philosophy)'s
  priority ordering).
- **No ADR for the Shared PDF Framework or the Google Translate provider
  integration.** Impact: a real architecture decision shipped
  undocumented. Recommendation: backfill both ADRs.
- **MQR's `records` API validates input ad hoc** (manual `String()`/regex)
  while NTR/PM use zod schemas. Impact: inconsistent validation
  discipline, easier to miss a field. Recommendation: migrate MQR onto the
  same zod pattern when the route is next touched for another reason.
- **No caching/memoization on translation calls** — every PDF export
  re-calls Google Translate per field, uncached. Impact: cost and latency
  scale linearly with export volume. Recommendation: cache by source-text
  hash.
- **69 `Promise.all` call sites vs. 2 `Promise.allSettled`** across page
  loaders. Impact: a single failed sub-query can crash an entire page
  render instead of degrading gracefully (Machine Passport already fixed
  this for itself in PR #77 — the pattern hasn't been extended elsewhere).
  Recommendation: sweep the highest-traffic loaders toward the same
  pattern.
- **`calcWarranty()`'s hardcoded 24/48-month limits bypass
  `businessConfig.ts`'s env-var override**, which only the NTR list's
  warranty filter honors. Impact: latent, not active (no env var is set
  today) — but a real two-sources-of-truth risk if one ever is.
  Recommendation: route `calcWarranty()` through the same config, or
  remove the unused override path — a deliberate decision either way, not
  a silent fix.

**Low priority**
- `.env.example` missing 4 vars actually read in code: `PASSWORD_EXPIRY_DAYS`,
  `PASSWORD_MIN_AGE_HOURS`, `WARRANTY_GENERAL_MONTHS`,
  `WARRANTY_POWERTRAIN_MONTHS`.
- DealerBranchScope and the Storage Platform/R2 decision live in prose
  docs (`docs/engineering/STORAGE_PLATFORM_DECISION.md`) rather than
  formal ADRs.
- One inline role check outside `scope.ts`
  (`api/attachments/orphan-cleanup/route.ts`).
- Sequential (non-parallelized) per-family DB writes in maintenance
  program sync (`db.ts`, `syncMaintenanceProgramVersionsForInterval`).

---

## 11. Roadmap

Status legend: **Completed** (shipped, merged) / **In Progress** (branch
exists, not yet merged) / **Planned** (scoped, not started, requires its
own plan/approval before work begins — see [§14](#14-development-philosophy)).

### Production Stabilization
- **In Progress** — the six regression fixes in
  [§9](#9-production-regression-history) (branch
  `fix/production-regression-audit`), pending review/merge.
- **Planned** — the High-priority items in
  [§10](#10-known-technical-debt) (auth/scope/db.ts test coverage,
  upload validation hardening, observability layer). None scheduled to a
  specific milestone yet.

### Platform (Milestone v2.4)
- **In progress, Priority 1** — Issue #79, Platform Image Management:
  MQR, NTR, PM, Delivery/PDI, and Vehicle360/Machine Passport now consume the
  locked shared image platform. Knowledge remains compatibility-only. The adoption and deprecation
  inventory is recorded in
  `docs/architecture/IMAGE_PLATFORM_ADOPTION_REPORT.md`.
- **Planned, Priority 2** — Issue #80, Placeholder-based terminology
  preservation (see [§8](#8-decision-log)).

### UX
- No dedicated UX milestone currently scheduled beyond what's captured in
  Issue #79 above.

### Enhancements / Future Architecture
- **Planned, not scheduled** — Engineering Language Platform: Translation
  Memory, Translation Review, Translation Approval, Corporate Glossary
  management UI, Parts/EPC/Warranty Translation, AI-assisted Translation
  Review. Explicitly excluded from PR #78's scope; none has a plan or
  approval (see [§8](#8-decision-log), [§12](#12-ai-working-rules)).
- **Recommended, not started** — Service Platform v1.0 (Preventive
  Maintenance/Warranty/Campaign/Parts/Service Visit/Field Service/Service
  History/Technician), the next epic after Machine Delivery Platform per
  `docs/ROADMAP.md`'s own recommended build order. Must reuse Machine
  Passport, Delivery, Knowledge, Activity Timeline, Attachment Platform,
  Authorization, and the Dashboard Framework — not rebuild any of them.
- **Recommended, not started, further out**: AI Troubleshooting →
  Engineering Intelligence → PIP → Predictive Quality → Dealer Portal →
  Customer Portal → IoT. See `docs/ROADMAP.md` for the full sequencing
  rationale and the Knowledge Foundation's AI Contract every one of these
  is bound by.

Full detail, historical milestones, and the Working Rules every phase
follows: `docs/ROADMAP.md`. This section is a summary, not a replacement.

---

## 12. AI Working Rules

Permanent, binding rules for any AI agent (or human) working in this
repository — supplementing, never overriding, root `CLAUDE.md` and
`.claude/rules/*.md`.

- **Read this file, `docs/ROADMAP.md`, and any relevant ADR before
  starting work.** Verify current branch and that the working tree is
  clean before touching anything.
- **Never redesign working architecture.** A Frozen Foundation layer
  ([§2](#2-system-architecture)) gets bug/security/performance fixes only,
  never a parallel implementation or a speculative rewrite — flagging debt
  ([§10](#10-known-technical-debt)) is not authorization to fix it
  immediately.
- **Always perform root cause analysis** before writing a fix — see every
  entry in [§9](#9-production-regression-history) for the standard (root
  cause identified and stated, not just the symptom patched).
- **Always preserve business rules** ([§3](#3-business-rules)). If an
  implementation appears to differ from an approved rule, that is a
  production defect to report and fix with a regression test — never a
  silent behavior change, and never a guess at what the rule "should" be.
- **Always prefer shared implementations** ([§5](#5-shared-platform-components)).
  A second copy of an existing pattern is a defect, not a convenience.
- **Repository owns filtering. Service owns business logic. UI remains
  thin.** ([§2](#2-system-architecture)) — the one architectural sentence
  worth memorizing.
- **Fix production regressions before enhancements** — see
  [§14](#14-development-philosophy)'s priority ordering. Do not let a
  bug-fix task drift into feature work, and do not let a feature request
  skip ahead of an open regression.
- **Always add regression tests** for a fixed defect, asserting the actual
  failure mode.
- **Never silently change a business rule.** If a change requires
  reinterpreting [§3](#3-business-rules), stop and ask — never guess.
- **Document architectural decisions.** A new cross-module shared
  abstraction or third-party integration gets an ADR (see the gap flagged
  for PR #78's own PDF/translation work in
  [§10](#10-known-technical-debt) — don't repeat it).
- **Keep pull requests focused.** One issue, one branch, one logical
  change ([§6](#6-engineering-standards)).
- **Avoid unnecessary refactoring.** A bug fix doesn't need surrounding
  cleanup; don't expand scope beyond what was asked — if more files
  genuinely need to change, stop, explain why, and ask before proceeding.
- **Update documentation before completion, not after.** Documentation is
  part of implementation, not a follow-up task — see
  [§13](#13-definition-of-done).

---

## 13. Definition of Done

A pull request is **not** complete until documentation is synchronized in
the *same* PR — never postponed to a follow-up. Documentation updates are
mandatory whenever a change affects:

Architecture · Business Rules · Shared Components · Repository Structure ·
API Contracts · Database Schema · Storage · Translation · PDF ·
Permissions · Deployment · Roadmap · Release Status · Operational
Procedures.

If none of the above changed, no documentation update is required —
don't edit a doc file just to have touched one. If any of the above
*did* change, update the specific document(s) actually affected
([§17](#17-repository-governance)) — reuse and extend existing sections
rather than rewriting a whole document wholesale, unless the task
explicitly calls for a full rewrite.

---

## 14. Development Philosophy

Repository priorities, in mandatory order. A lower-numbered concern always
outranks a higher-numbered one — a security fix is never deferred for a
feature, and an enhancement never jumps ahead of an open regression:

1. Production Outage
2. Production Regression
3. Business Rule Correctness
4. Security
5. Data Integrity
6. Performance
7. Maintainability
8. Platform Standardization
9. UX Improvements
10. New Features

Production stability always outranks enhancements. When a task's scope is
ambiguous between "fix" and "improve," default to the smallest change that
restores correct behavior, and file the improvement separately (see
[§8](#8-decision-log)'s Issue #80 example — this is exactly the discipline
that produced it).

---

## 15. Release Checklist

Run for every release (not every PR — see
[§16](#16-task-completion-checklist) for per-task verification):

- ☐ Architecture Check passes
- ☐ Typecheck passes
- ☐ Lint passes
- ☐ Tests pass
- ☐ Build passes
- ☐ Regression tested (every defect fixed this release has a dedicated
  test)
- ☐ Business Rules verified ([§3](#3-business-rules) re-traced if any
  touched module changed)
- ☐ Documentation updated ([§13](#13-definition-of-done))
- ☐ `docs/ROADMAP.md` updated
- ☐ `HANDOFF.md` updated (this file)

---

## 16. Task Completion Checklist

Run for every individual task/issue before reporting it complete:

- ☐ Architecture verified (existing implementation, related types,
  repository, service, API, ADR, and DB schema all read before changing
  anything — never write code from memory of a prior session)
- ☐ Business Rules verified (no rule in [§3](#3-business-rules)
  contradicted, silently or otherwise)
- ☐ Code complete
- ☐ Tests updated
- ☐ Regression tests added for any fixed defect
- ☐ Build passes
- ☐ Documentation updated ([§13](#13-definition-of-done))
- ☐ `HANDOFF.md` updated, if applicable
- ☐ `docs/ROADMAP.md` updated, if applicable
- ☐ `RELEASE_NOTES`/release doc updated, if applicable
- ☐ ADR updated or added, if architecture changed
- ☐ Repository left in a consistent state (clean working tree or clearly
  reported pending changes, no half-finished edits)

---

## 17. Repository Governance

This repository follows mandatory engineering governance. The following
are **living documents** — kept current as part of the same PR that makes
them stale, per [§13](#13-definition-of-done), not batched into a separate
documentation pass:

- **`HANDOFF.md`** (this file) — the engineering source of truth for
  current state, architecture, business rules, and working rules.
- **`docs/ROADMAP.md`** — planned/completed milestones, working rules per
  phase, open questions.
- **Release notes** (`docs/releases/RELEASE_NOTES_*.md`) — one per
  release, what shipped and why.
- **`docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`** and the
  Architecture Blueprint (`docs/architecture/blueprint/`) — the current
  and long-term architecture reference (`docs/ARCHITECTURE.md` is stale,
  do not use it).
- **ADRs** (`docs/adr/`, indexed in `docs/adr/README.md`) — one ADR, one
  number, one topic; required for any change to a Frozen Foundation layer
  or the Architecture Baseline ([§2](#2-system-architecture)).
- **API documentation** — inline in each route file's own doc comments;
  no separate generated API reference exists today.

Governance itself is versioned: `.claude/rules/git.md` governs how this
repository's git/GitHub operations happen and is itself only changeable
via an explicit Product-Owner-approved, dedicated documentation PR, never
bundled with application code.

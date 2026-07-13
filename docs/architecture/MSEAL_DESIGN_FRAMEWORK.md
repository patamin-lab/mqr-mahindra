# MSEAL Design Framework v1.0

Decision record: `docs/adr/ADR-023-MSEAL-Design-Framework.md`. This
document is the ten requested deliverables in one place, kept in sync
with the code the same way `IMPORT_PLATFORM.md` tracks ADR-022. It does
not restate what `docs/DESIGN_SYSTEM.md` (aspirational target) and
`docs/UI_STANDARD.md` (current-state, binding) already own - see each
section for what's new here versus what's a pointer to an existing doc.

This is **not a visual redesign**. Tailwind tokens, brand colors, and the
frozen buttons/cards/typography in `UI_STANDARD.md` are unchanged.

---

## 1. Design Framework

The Framework is four layers, each already-existing or newly-added as
noted:

| Layer | Owner doc | Status |
|---|---|---|
| Visual tokens (color, spacing, shadow, radius, type scale) | `docs/UI_STANDARD.md`, `tailwind.config.ts`, `globals.css` | Existing, unchanged |
| Component catalog (Card, KpiCard, PageHeader, StatusPill, forms, tables, timeline) | `docs/UI_STANDARD.md`, `src/components/shared/` | Existing, extended (7 new widgets, 3 new generic states - see §4) |
| Navigation/Dashboard/Screen structure | This document + ADR-023 | **New** |
| Agent-facing operational checklist | `.claude/skills/mseal-platform-design/` | **New** |

Governance: Design Framework is now the tenth entry in
`docs/architecture/PLATFORM_CONSTITUTION.md`'s Foundation Freeze -
modifiable only for a confirmed defect, security issue, measurable UX/
performance problem, or a further approved ADR.

---

## 2. Platform Navigation Standard

Structure: a fixed list of top-level **Groups**, each holding flat
**Items** or one level of **Subgroups** (never deeper). Every leaf is
either a real route or an explicit, disabled "Coming Soon" placeholder -
never a fake/broken link. Implementation: `src/app/(app)/navConfig.ts`'s
`getNavGroups(t, session)`, rendered by `src/app/(app)/sidebar.tsx`.

| Group | Item | Route | Status |
|---|---|---|---|
| 🏠 Dashboard | Platform Overview | `/dashboard` | **Real** (rebuilt this pass) |
| 🚜 Machines | Machine Registry | `/vehicles` | Real (existing) |
| | Machine Passport | - | Coming Soon |
| | New Tractor Registration | `/ntr` | Real (existing) |
| | Legacy Import | `/admin/legacy-import` | Real (existing, SuperAdmin) |
| 🔧 Service | Preventive Maintenance | `/pm-records` | Real (existing) |
| | Warranty | - | Coming Soon (no module/table) |
| | Campaigns > Service Campaign (Future) | - | Coming Soon |
| | Campaigns > Product Improvement Plan (Future) | - | Coming Soon |
| ⚠️ Quality | Dashboard (แดชบอร์ดคุณภาพ) | `/quality/dashboard` | Real (moved MQR dashboard) |
| | Cases (รายงานปัญหาคุณภาพ) | `/records` | Real (existing) |
| | Analytics (การวิเคราะห์) | - | Coming Soon |
| | Troubleshooting (การแก้ไขปัญหา) | - | Coming Soon (moved here from Engineering Intelligence - see §2a) |
| | Knowledge (องค์ความรู้) | - | Coming Soon |
| 🧠 Engineering Intelligence | AI Engineering | - | Coming Soon |
| | Product Improvement Plans (PIP) | - | Coming Soon |
| | Predictive Quality | - | Coming Soon |
| 📊 Reports (cross-cutting, not a domain - see §2b) | Executive / Operations / Dealer / Export | - | Coming Soon (all four - no module) |
| ⚙️ Administration | Users | `/admin/users` | Real (existing) |
| | Master Data (subgroup: Dealers/Branches/Technicians/Problem Codes/PM Intervals/Product Families/Product Family Models/Maintenance Programs) | `/admin/*` | Real (existing) |
| | Import History | `/admin/import-history` | **Real** (new this pass) |
| | Audit | - | Coming Soon (no cross-module audit UI yet) |
| | Sessions | - | Coming Soon (only self-service `/profile/security` exists, no admin cross-user view) |
| | System Health | `/admin/email-health` | Real (existing, relabeled) |
| | Settings | - | Coming Soon |

**Open item, not silently resolved**: PDI (Pre-Delivery Inspection) and
Parts Request appeared in the old flat Official Menu Standard
(`docs/standards/DOMAIN_LANGUAGE_STANDARD.md`) as recognized future
modules, but have no entry - real or Coming Soon - in this new
navigation, because the brief's own Target Navigation omits them. They
remain named future modules in the Architecture Blueprint's Business
Capability Map. Whether they should get a Coming Soon nav entry too is a
deliberate call for product direction, flagged here rather than decided
unilaterally.

Role gating is unchanged in spirit from before: nav visibility is
UX-only, every route re-checks the same `lib/scope.ts` predicate
server-side (`docs/standards/SECURITY_STANDARD.md`).

### 2a. Quality owns execution, Engineering Intelligence owns analysis (UI Terminology & Navigation Cleanup)

**Supersedes this section's original "pre-merge refinement" split.**
Quality owns operational execution - Quality Cases (รายงานปัญหาคุณภาพ),
Knowledge (องค์ความรู้), and **Troubleshooting**, the technician-facing
activity of diagnosing an active quality problem. Engineering Intelligence
consumes that validated Quality/Knowledge/Troubleshooting data to produce
analysis and improvement plans - **AI Engineering**, **PIP**, and
**Predictive Quality** - it does not own execution and does not get its
own separate "Knowledge Engine" entry (Knowledge lives under Quality) or
a second Troubleshooting entry. Troubleshooting has exactly one nav
entry, under Quality - never a second copy under Engineering
Intelligence.

Engineering Intelligence also no longer carries separate "AI Analysis"
and "Insights" entries - both are consolidated into the one **AI
Engineering** entry, since neither represented a distinct, real
capability beyond "AI-produced analysis." Engineering Intelligence now
exposes exactly three items: AI Engineering, PIP, Predictive Quality
(renamed from Prediction).

PIP is produced *from* Quality Cases/Knowledge but is itself an
Engineering Intelligence deliverable, not a Quality one - it has exactly
one Quality-adjacent nav entry, under Engineering Intelligence, never
duplicated under Quality. **PIP still also appears under Service >
Campaigns** (`Product Improvement Plan (Future)`) - that entry is
unchanged and is not a duplicate of the Engineering Intelligence one: it
represents Service's own campaign-tracking view of a PIP once one exists,
not a second copy of the PIP page itself. Both are Coming Soon today, so
there is no duplicated *page* either way - only a documentation
distinction worth keeping straight once a real PIP module exists.

Troubleshooting (Coming Soon, Quality-owned) is architecture-reserved
only: future AI-assisted troubleshooting, knowledge-guided diagnostics,
failure trees, decision trees, repair procedures. No functionality is
implemented. The Machine Digital Passport (`docs/architecture/
MACHINE_PASSPORT_ARCHITECTURE.md`) reserves a matching single section for
it, moved out of the Knowledge Integration tile grid so it is not
duplicated there either.

Recall was removed entirely (not carried forward as Coming Soon,
including its former Service > Campaigns entry and the dashboard's
"Recall / Service Campaigns" placeholder card, now just "Service
Campaigns") - no Recall module or data exists, and it had no distinct
destination from Service Campaign.

### 2b. Reports is cross-cutting, not a business domain

Reports consumes data from Machines, Service/PM, Warranty, Quality,
Engineering Intelligence, and the Import Platform - it owns no data of
its own and is not itself a business domain the way Machines/Service/
Quality are. It keeps a nav group (the same way Administration - also
cross-cutting - keeps one), now explicitly documented as such in
`navConfig.ts`'s own comments. No existing report was touched, redesigned,
or moved by this statement - it is a documentation clarification only.

---

## 3. Dashboard Standard

**Dashboard = Decision Center, not a Statistics Page.** Every widget
answers "what should the user do next," not just "what is the number."

- **Platform Overview** (`/dashboard`) - platform-wide, role-aware.
  Real KPIs today: Registered Machines (role-scoped vehicle count),
  Open Quality Cases (role-scoped open-MQR count), Pending Imports
  (SuperAdmin only), System Health (reuses the existing Tractor-IN sync
  health check, `seesAllDealers` roles only). Quick Actions: Register
  New Tractor, Machine Registry, Quality Cases, Legacy Import
  (SuperAdmin). **Today's Activities** (pre-merge refinement, real widget,
  `seesAllDealers` roles only) reuses `<ActivityTimeline>` - the same
  platform-standard component every module's own record page already
  renders through, not a second timeline - fed by every
  `record_audit_log` row from today across every module (see §4, §7).
  Explicitly-labeled Coming Soon widgets (not fabricated zeros, not silent
  omission) for Active Warranty, Open PM, Recall/Service Campaigns - none
  has a real, queryable data source yet (see §7 Gap Analysis; PIP itself
  moved off this page's Coming Soon list entirely - it now lives under
  Engineering Intelligence, §2a).
- **Quality Dashboard** (`/quality/dashboard`) - the pre-existing MQR
  analytics dashboard (backlog KPIs, status/aging charts, Pareto,
  leaderboards), moved unchanged. This is the Quality domain's own
  dashboard under the new structure, not replaced or redesigned.
- **Machines / Service / Engineering Intelligence dashboards** - designed
  (this document, ADR-023) but not built this pass. None has enough real
  backing data (no Warranty table, no aggregate PM-due query, no AI/
  Knowledge module) to justify a dashboard beyond what Quick Actions
  already surface on Platform Overview and the domain's own list pages.

Every dashboard widget follows: **Primary KPI + Secondary Context +
Primary Action** (`KpiCard`'s new optional `action` slot; see §4).

---

## 4. Widget Standard

Seven named, reusable contracts. All under
`src/components/shared/dashboard/` unless noted.

| Widget | Component | New/Existing |
|---|---|---|
| Statistic Card | `KpiCard` | Existing, extended non-breakingly (`action?` prop) |
| Chart Card | `ChartCard` | **New** - `decision` prop is required; a chart with no stated decision doesn't get this wrapper (Chart Guideline) |
| Timeline Card | `ActivityTimeline` (`shared/activity-timeline/`) | Existing platform standard, reused - now also live on Platform Overview's "Today's Activities" (pre-merge refinement), fed by a new cross-record adapter, `mapMixedAuditLogToActivityEvents()`, sibling to the existing single-record `mapAuditLogToActivityEvents()` - no second timeline component |
| Notification Card | `NotificationCard` | **New** |
| Quick Action Card | `QuickActionCard` | **New** |
| Health Card | `HealthCard` | **New** |
| Progress Card | `ProgressCard` | **New** |

Plus three generic states, under `src/components/shared/layout/`,
distinct from the existing table-row-scoped `admin/EmptyState.tsx` and
`admin/LoadingState.tsx`:

- `EmptyState` - title + **reason** (why) + **next step** (what to do) +
  optional action; never bare "No Data" (see the Empty State Guideline,
  `.claude/skills/mseal-platform-design/EMPTY_STATE_GUIDELINES.md`).
- `ErrorState` - problem + reason + resolution + optional retry (Error
  State Guideline).
- `Skeleton` - generic shimmer block for non-table loading states.

Plus a **Global Search UI placeholder** (`GlobalSearchButton`,
`PlatformHeader`, pre-merge refinement) - not one of the seven widget
contracts (it's header chrome, not a dashboard widget), but architecture-
reserved the same way: disabled, tooltip-only, mirroring
`NotificationBell`'s exact existing pattern rather than a new placeholder
language. No backend - the data contract it will eventually wire into is
`docs/SEARCH_MODEL.md`, unchanged by this pass (see `SEARCH_GUIDELINES.md`).

---

## 5. Screen Contract

Every screen going forward documents: Purpose, Primary User, Primary
Decision, Primary Action, Success Criteria, Permissions, Navigation,
KPIs, Quick Actions, Timeline, Related Records, Future AI Panel. Applied
here to two worked examples (not retrofitted to every existing screen -
see §8 Migration Roadmap):

### Platform Overview (`/dashboard`)
- **Purpose**: one screen answering "is the platform healthy and what
  needs my attention right now."
- **Primary User**: every authenticated role (content varies by role).
- **Primary Decision**: where should I go next - a quality case, an
  import, a new registration.
- **Primary Action**: one of the Quick Actions.
- **Success Criteria**: user reaches the right module in one click.
- **Permissions**: `getSession()` gate; per-widget role checks
  (`canManageLegacyImport`, `seesAllDealers`) hide, never fake, data.
- **Navigation**: Dashboard group, single item.
- **KPIs**: Registered Machines, Open Quality Cases, Pending Imports,
  System Health.
- **Quick Actions**: as listed in §3.
- **Timeline**: **Today's Activities** (pre-merge refinement) - real,
  `<ActivityTimeline>`, `seesAllDealers` roles only (see §7 for the scoping
  reason).
- **Related Records**: none (this screen is a router, not a record view).
- **Future AI Panel**: reserved slot - see §14.
- **Global Search**: header-level placeholder (`GlobalSearchButton`), not
  page-specific - present on every authenticated page via `PlatformHeader`,
  not just this one.

### Import History (`/admin/import-history`)
- **Purpose**: full, auditable Legacy Import session history.
- **Primary User**: Super Administrator.
- **Primary Decision**: did a given import run succeed; which session to
  investigate further.
- **Primary Action**: none required (read-only) - the wizard's own
  "View All" link is how a user arrives here from the action screen.
- **Success Criteria**: every historical session is visible with its
  outcome counts.
- **Permissions**: `canManageLegacyImport` (SuperAdmin only), same gate
  as Legacy Import itself.
- **Navigation**: Administration > Import History.
- **KPIs**: none (this is a list, not a dashboard).
- **Quick Actions**: none (see above).
- **Timeline**: not applicable - session rows are themselves the record.
- **Related Records**: none surfaced yet - a future link from a session
  row to its resulting NTR/Machine records is named in §8.
- **Future AI Panel**: reserved slot - see §14.

---

## 6. Enterprise UX Checklist

Applied to every screen touched this pass (Platform Overview, Import
History, Legacy Import's trimmed history section):

- [x] Native HTML forms where forms exist (Legacy Import's upload step
      already used a real `<form>`/file input - unchanged).
- [x] Keyboard: no screen here removes existing keyboard support; Login's
      Enter-to-submit was verified already correct in a prior pass (no
      change needed - see Release Notes below).
- [x] No "No Data" - every empty/未-built state uses `EmptyState` with a
      reason and next step, or Coming Soon styling.
- [x] Every error path (Platform Overview's data queries) already threw
      through the existing Server Component error boundary; `ErrorState`
      is available for any future client-side fetch on these screens.
- [x] Skeleton-first loading is available (`Skeleton`) for any future
      client-rendered widget; both new pages here are Server Components
      with no client-side loading state to skeleton.
- [x] Every chart kept (Quality Dashboard, unchanged) already has a
      `note`/decision caption via `Panel`; new charts should use
      `ChartCard` going forward.
- [x] Responsive: new pages reuse the existing `grid-cols-1
      sm:grid-cols-2 lg:grid-cols-*` mobile-first pattern, nothing novel.
- [x] Accessibility: `EmptyState`role is implicit text content (no ARIA
      needed beyond existing focus/contrast rules); `Skeleton` carries
      `role="status" aria-label="Loading"`.
- [ ] **Not done this pass**: a full accessibility audit (screen reader
      pass, contrast check) of the seven new widgets - named in §9
      Technical Debt.

---

## 7. Gap Analysis

| Area | Gap | Why not closed this pass |
|---|---|---|
| Active Warranty KPI | No Warranty table/module exists (`lib/warranty.ts` is pure calculation logic only) | Building a fake KPI around no data would violate the Dashboard Standard being established here |
| Open PM KPI | No aggregate "PM due" query exists - due-date evaluation is per-vehicle (`MaintenanceDueService`), not batched | Real engineering effort (a new batched query), out of this pass's scope |
| PIP / Knowledge / AI Engineering / Predictive Quality / Troubleshooting | No module exists for any of these (Quality vs. Engineering Intelligence ownership - §2a) | Named future modules, not built speculatively |
| Cross-module Today's Activities scoping | **Partially resolved this pass** - `<ActivityTimeline>` now shows real, today-only, cross-module events, but only to `seesAllDealers` roles; `record_audit_log` carries no dealer/branch column, so a DealerAdmin/DealerUser-scoped version would need an additional per-module join this pass doesn't build | Scoping the feed per-dealer for every role is real engineering effort; showing it unscoped to a scoped role would be a permission regression, so it's gated off instead - named in Migration Roadmap |
| Notifications | `NotificationBell` is a static placeholder, no backing query | Pre-existing gap, unchanged by this pass; `NotificationCard` is ready for whenever a real notification source exists |
| Universal Search UI | `docs/SEARCH_MODEL.md` defines the data contract; no UI built | Genuinely greenfield - named in Migration Roadmap, not attempted this pass |
| PDI / Parts Request navigation | Present in the old flat Menu Standard, absent from the new Target Navigation (real or Coming Soon) | Flagged for product direction, not resolved unilaterally (see §2) |
| Icon library contradiction | `DESIGN_SYSTEM.md`/`TECH_STACK.md` said Lucide React; `UI_STANDARD.md` says none | **Resolved this pass** - see ADR-023 "Conflicts resolved" |
| Header-existence contradiction | `docs/COMPONENT_CATALOG.md` (scanned a different branch) says no Header component exists; `UI_STANDARD.md`/this codebase have `PlatformHeader.tsx` | Not resolved here - `COMPONENT_CATALOG.md` scans live `main`, not this local clone; flagged for whoever next refreshes that catalog |
| `admin/EmptyState.tsx` default message | Its default is "ไม่มีข้อมูล" ("No Data") - contradicts the new Empty State Guideline | Not fixed - component is unused by any screen today (confirmed), so left as a named, zero-risk cleanup item rather than touched speculatively |

---

## 8. Migration Roadmap

Phased, matching this repo's own "design-only-until-approved" precedent
(`docs/ADMIN_FRAMEWORK.md`):

1. **Now (this PR)**: Navigation Standard, Platform Overview, Quality
   Dashboard move, seven widgets + three generic states, Import History
   page, Archive Queue UI removal; pre-merge refinement: PIP moved to
   Engineering Intelligence, Troubleshooting added, Reports documented as
   cross-cutting, Today's Activities + Global Search placeholder added.
   **UI Terminology & Navigation Cleanup pass (later)**: Quality Cases
   standardized to "รายงานปัญหาคุณภาพ" everywhere in the UI; Recall removed
   entirely (no Coming Soon carry-forward); Troubleshooting moved from
   Engineering Intelligence to Quality (execution vs. analysis - see
   §2a); Engineering Intelligence's "AI Analysis"/"Insights"/"Knowledge
   Engine" entries consolidated/removed, leaving exactly AI Engineering/
   PIP/Predictive Quality; Platform Overview's remaining hardcoded English
   labels moved through the i18n system (`dashboard.*` namespace); Machine
   Digital Passport gained a matching reserved Troubleshooting section.
   See `docs/standards/TERMINOLOGY_STANDARD.md`.
2. **Next**: retrofit the Screen Contract onto every existing detail page
   (records/[jobId], ntr/[id], pm-records/[id], vehicles/[serial]) -
   review each against the template rather than a mechanical stamp.
3. **Next**: batched "PM due" query -> real Open PM KPI on Platform
   Overview and a Service domain dashboard.
4. **Next**: scope Today's Activities per-dealer for DealerAdmin/
   DealerUser (currently `seesAllDealers`-only) - needs a join from
   `record_audit_log` back to each module's own scoped record set; real
   effort, not attempted this pass to avoid a permission regression.
5. **Later**: Universal Search UI on top of the existing `SEARCH_MODEL.md`
   contract.
6. **Later**: Machines/Service/Engineering Intelligence domain dashboards,
   once each has real backing data (Machine Passport content, Warranty
   table, a Knowledge/AI module).
7. **Later**: Reports module (Executive/Operations/Dealer/Export) - no
   real requirement or data shape agreed yet.
8. **Later**: Import Preview color taxonomy (🟢🟡🔵🟠🔴) and cancelable/
   resumable import processing for 5000+ rows - both named in ADR-022,
   still deferred.
9. **Later**: a resolved decision on PDI/Parts Request's navigation
   presence (§2, §7).

---

## 9. Technical Debt Report

- Seven new widgets have not had a full accessibility audit (screen
  reader pass, automated contrast check) - built to the same Tailwind
  tokens and focus-visible ring as every existing component, but not
  independently verified.
- `docs/COMPONENT_CATALOG.md` and `docs/SHARED_UI_ANALYSIS.md` were
  scanned against a different branch/point in time than this local clone
  (their own header notes say so) - both are due a refresh against this
  codebase's actual current state; not attempted here to avoid conflating
  that refresh with this framework's own changes.
- `admin/EmptyState.tsx`'s "No Data" default message contradicts the new
  Empty State Guideline but is unused anywhere - a zero-risk fix for
  whoever next touches that file.
- No cross-module notification/activity aggregation service exists;
  `NotificationCard`/the Platform Overview's Coming Soon Latest Activities
  slot are ready for one whenever it's built.
- `getServerLocale()`/`t()` were used directly in the two new Server
  Component pages, matching existing precedent
  (`pm-records/[id]/page.tsx` etc.) - no new i18n mechanism introduced.

---

## 10. Future Recommendations

- Build the batched PM-due query before the Service domain dashboard -
  it's the one real, scoped piece of engineering blocking two roadmap
  items (Open PM KPI, Service dashboard) at once.
- Resolve PDI/Parts Request's navigation presence in the same pass as
  whichever of those two modules gets built first, rather than as a
  standalone documentation change.
- When Engineering Intelligence gets its first real module, use the
  reserved "Future AI Panel" slot named in the Screen Contract (§5, §14)
  rather than redesigning the screens it appears on.
- Refresh `docs/COMPONENT_CATALOG.md`/`docs/SHARED_UI_ANALYSIS.md` against
  this local clone's actual state before relying on either for a future
  gap analysis - both are dated relative to a different branch.

---

## 14. Future AI Panel (reserved area)

Per the brief's "Future AI Ready" section: every Screen Contract (§5)
names a "Future AI Panel" slot. No AI Summary/Insight/Recommendation/
Action component is built this pass (Engineering Intelligence has no
module yet, §7). The convention going forward: a Future AI Panel is a
plain, clearly-labeled Coming Soon `EmptyState` in the same position a
real AI panel would eventually occupy - reserving the layout slot without
inventing a fake AI feature. No new component is needed for this today;
`EmptyState` with `comingSoon` already covers it.

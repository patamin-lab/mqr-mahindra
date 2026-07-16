/**
 * Single source of truth for the app's navigation entries - consumed by
 * both `Sidebar` (desktop aside + mobile drawer) and `PlatformHeader`
 * (breadcrumb/module-title lookup), so there is exactly one nav list, not
 * two independently maintained ones.
 *
 * Navigation Standard (MSEAL Design Framework, ADR-023,
 * `docs/architecture/MSEAL_DESIGN_FRAMEWORK.md`): the platform's menu is a
 * fixed set of top-level Groups, each holding either a flat `items[]` list
 * or one further level of `subgroups[]` (never deeper - two levels of
 * nesting is the ceiling, matching every enterprise nav pattern already
 * reviewed for this framework). Every leaf is either a real route (`href`
 * set, `comingSoon` omitted) or a named placeholder for a module that has
 * no implementation yet (`href: null`, `comingSoon: true`) - the same
 * "(Coming Soon)"/"(Future)" treatment the framework's own Target
 * Navigation already uses for Machine Passport/Service Campaign/PIP,
 * applied consistently to every other not-yet-built leaf instead of
 * quietly omitting it. A Coming Soon leaf is never given a fake route -
 * `Sidebar` renders it disabled, not as a broken or placeholder link.
 *
 * This supersedes the old flat `getPrimaryNav()`/`getAdminNav()` pair
 * (kept working behaviourally identical for every *real* route - no
 * existing href/role gate changes) with one `getNavGroups()`. It also
 * supersedes `docs/standards/DOMAIN_LANGUAGE_STANDARD.md`'s older flat
 * "Official Menu Standard" table - see that document's own updated note
 * pointing back here.
 *
 * Capability visibility (Navigation Visibility Refinement, post-Foundation
 * Freeze; Production Pilot policy update, `docs/architecture/
 * BUSINESS_WORKFLOW_CONSOLIDATION_AUDIT.md`): navigation represents
 * available business capability, not the product roadmap. Every leaf has
 * a `CapabilityStatus`; `getNavGroups` shows only `ACTIVE` leaves to
 * every role, including SuperAdmin, for the duration of Production Pilot
 * ("Production Pilot exposes only completed workflows" - an unfinished
 * capability is hidden completely, never shown disabled). This is one
 * generic status-driven filter (`isCapabilityVisible`), applied uniformly
 * to every group - there is no per-module special case. A group or
 * subgroup left with zero visible items after filtering is omitted
 * entirely, the same "never render an empty container" rule the
 * Administration group already used. Not-yet-built capabilities
 * (Troubleshooting, Engineering Intelligence, Reports, Warranty, PIP,
 * Service Campaign, ...) are named, real gaps tracked in the architecture
 * docs above, deliberately not scaffolded here as inert Coming Soon
 * placeholders while they stay permanently hidden - `effectiveStatus`/
 * `CapabilityStatus`/`comingSoon` (the `NavItem` field) stay in place for
 * whenever the next capability needs the same treatment post-Pilot; only
 * the now-dead `comingSoon()` construction helper was removed. This is a
 * UX-visibility rule only - every gated leaf still has `href: null` (no route exists to
 * protect); see `docs/standards/SECURITY_STANDARD.md`'s Application-layer
 * authorization section for how *real* routes are separately enforced
 * server-side regardless of what the nav shows.
 */
import { SessionUser } from '@/lib/types';
import { canManageMasterData, canManageEmailHealth, canManageUsers, seesAllDealers, canAccessImportInspection } from '@/lib/scope';
import type { TranslationVars } from '@/lib/i18n/types';

/**
 * A capability's build/rollout state, independent of who may see it.
 * `ACTIVE` is the only status visible to any role during Production Pilot
 * - see `isCapabilityVisible`. The other four all mean "not yet a
 * capability a regular user can act on," kept as distinct labels for
 * whenever a future, post-Pilot roadmap preview needs to tell them apart.
 */
export type CapabilityStatus = 'ACTIVE' | 'COMING_SOON' | 'PREVIEW' | 'BETA' | 'DEVELOPMENT';

export interface NavItem {
  /** `null` for a not-yet-`ACTIVE` placeholder - never a fake/broken route. */
  href: string | null;
  icon?: string;
  label: string;
  /** @deprecated Kept only as the Coming Soon rendering flag `Sidebar` reads
   *  for its badge/disabled treatment; visibility itself is driven by
   *  `status`, via `isCapabilityVisible` - never read this to decide
   *  whether to show an item. */
  comingSoon?: boolean;
  /** Explicit override for a non-Coming-Soon future status (Preview/Beta/
   *  Development). Omitted on every item today (`effectiveStatus` derives
   *  `ACTIVE`/`COMING_SOON` from `comingSoon` when this is unset) - reserved
   *  for the next capability that needs a Preview/Beta/Development badge
   *  instead of Coming Soon, without a new boolean flag or a new filter. */
  status?: CapabilityStatus;
}

/** The one place that reads `comingSoon`/`status` to decide a leaf's actual
 *  capability state - every other piece of code (filtering, rendering)
 *  should call this rather than re-deriving it. */
export function effectiveStatus(item: NavItem): CapabilityStatus {
  if (item.status) return item.status;
  return item.comingSoon ? 'COMING_SOON' : 'ACTIVE';
}

/**
 * Navigation Visibility Rule - Production Pilot policy: "Production Pilot
 * exposes only completed workflows" applies to every role, including
 * SuperAdmin - the pre-Pilot "SuperAdmin sees the whole roadmap" exception
 * is suspended for the duration of the Pilot, not removed from the
 * mechanism itself (`effectiveStatus`/`CapabilityStatus`/`NavItem.
 * comingSoon` all stay - the next capability added post-Pilot still gets
 * the same Coming Soon treatment for whoever the business decides should
 * preview it). One generic rule, applied to every leaf regardless of which
 * group/module it belongs to.
 */
export function isCapabilityVisible(item: NavItem, _role: SessionUser['role']): boolean {
  return effectiveStatus(item) === 'ACTIVE';
}

export interface NavSubgroup {
  label: string;
  items: NavItem[];
}

export interface NavGroup {
  key: string;
  icon: string;
  label: string;
  /** A group has either flat `items` or one level of `subgroups` - never both. */
  items?: NavItem[];
  subgroups?: NavSubgroup[];
}

type Translate = (key: string, vars?: TranslationVars) => string;

/** Applies `isCapabilityVisible` to every leaf across every group/subgroup,
 *  dropping any subgroup or group left with zero visible items - the
 *  generic "hide the whole group if every child is hidden" rule, not a
 *  per-group special case (see the module doc comment). Runs last, after
 *  every group above has already applied its own RBAC item-inclusion
 *  logic - capability-status visibility and role-based inclusion are two
 *  independent filters, not one merged check. */
function filterGroupsByCapability(groups: NavGroup[], role: SessionUser['role']): NavGroup[] {
  return groups
    .map((group) => {
      const items = group.items?.filter((item) => isCapabilityVisible(item, role));
      const subgroups = group.subgroups
        ?.map((sub) => ({ ...sub, items: sub.items.filter((item) => isCapabilityVisible(item, role)) }))
        .filter((sub) => sub.items.length > 0);
      return { ...group, items, subgroups: subgroups && subgroups.length > 0 ? subgroups : undefined };
    })
    .filter((group) => (group.items?.length ?? 0) > 0 || (group.subgroups?.length ?? 0) > 0);
}

/**
 * The platform's full navigation tree, role-filtered. Every group with no
 * visible items for the current role is omitted entirely (never rendered
 * empty) - `Sidebar` doesn't need its own visibility logic beyond that.
 * Two independent filters apply: each item's own RBAC gate (who may use
 * this real capability - e.g. Import Inspection's `canAccessImportInspection`),
 * and the capability-status visibility rule (`filterGroupsByCapability`) -
 * whether this capability is finished enough for a non-SuperAdmin to see
 * at all.
 */
export function getNavGroups(t: Translate, session: SessionUser): NavGroup[] {
  const groups: NavGroup[] = [
    {
      key: 'dashboard',
      icon: '🏠',
      label: t('nav.dashboard'),
      items: [{ href: '/dashboard', label: t('nav.platformOverview') }],
    },
    {
      // Vehicle Lookup - elevated to its own top-level entry (Business
      // Workflow Consolidation, ADR-035/036/037), separate from any one
      // lifecycle stage. Machine Passport/Vehicle 360 is a persistent,
      // always-available window into one machine's whole history, used at
      // every stage from Import through retirement - grouping it with a
      // one-time workflow step (NTR, previously "Machines" together) was
      // organizing by entity, not by the business lifecycle this platform
      // now navigates by. Vehicle 360 consolidation (ADR-030) itself is
      // unchanged: one nav entry, not two - `/vehicles` now just redirects
      // to `/machines`, so it never needs its own entry.
      key: 'vehicleLookup',
      icon: '🚜',
      label: t('nav.vehicleLookupGroup'),
      items: [{ href: '/machines', label: t('nav.vehicle360') }],
    },
    {
      // Import & Inspection (renamed from "Quality Inspection" - Business
      // Workflow Consolidation found this group's own label used the wrong
      // business term; ADR-028 already corrected this domain's name to
      // "Import Inspection," the item labels below already say so, only
      // the group label had drifted). Belongs exclusively to MSEAL
      // (business-domain correction) - hidden from Dealer roles, server-
      // side route check is the real gate, this only hides the nav entry.
      // Underlying routes (`/delivery/pdi`, `/delivery/pdi/dashboard`) and
      // every other Delivery route/API/permission are unchanged.
      key: 'qualityInspection',
      icon: '🔍',
      label: t('nav.importInspectionGroup'),
      items: canAccessImportInspection(session.role)
        ? [
            { href: '/delivery/pdi/dashboard', label: t('nav.qualityInspectionDashboard') },
            { href: '/delivery/pdi', label: t('nav.qualityInspectionImport') },
          ]
        : [],
    },
    {
      // Delivery Lifecycle (new group, Business Workflow Consolidation) -
      // New Tractor Delivery (NTR) is a one-time workflow step in the
      // tractor's lifecycle, moved out of the old entity-based "Machines"
      // group (see `vehicleLookup` above). MSEAL Stock/Ship to Dealer/
      // Dealer Stock remain named, real gaps (`docs/architecture/
      // BUSINESS_WORKFLOW_UX_AUDIT.md`'s R-1, still an open business
      // decision) - not scaffolded here as inert nav placeholders, since
      // Production Pilot hides every not-yet-built capability regardless.
      key: 'deliveryLifecycle',
      icon: '🚚',
      label: t('nav.deliveryLifecycleGroup'),
      items: [{ href: '/ntr', label: t('nav.ntrRecords') }],
    },
    {
      key: 'service',
      icon: '🔧',
      label: t('nav.serviceGroup'),
      items: [{ href: '/pm-records', label: t('nav.pmRecords') }],
    },
    {
      // Domain ownership (UI Terminology & Navigation Cleanup): Quality
      // owns Quality Cases (MQR) as the operational execution activity -
      // technicians diagnosing an active quality problem. Engineering
      // Knowledge Platform (ADR-018): Knowledge is a real route
      // (`/quality/knowledge`), sitting under this Quality nav group
      // purely for UX/discoverability (the same place a technician
      // already looks), not because Quality owns its data - see
      // `docs/architecture/KNOWLEDGE_PLATFORM.md` §1/§7. Troubleshooting/
      // Quality Analytics/Engineering Intelligence/PIP/Reports remain
      // named, real gaps (`docs/architecture/BUSINESS_WORKFLOW_UX_AUDIT.md`)
      // - not scaffolded here, same reasoning as Delivery Lifecycle above.
      key: 'quality',
      icon: '⚠️',
      label: t('nav.qualityGroup'),
      items: [
        { href: '/quality/dashboard', label: t('nav.qualityDashboard') },
        { href: '/records', label: t('nav.qualityCases') },
        { href: '/quality/knowledge', label: t('nav.qualityKnowledge') },
      ],
    },
  ];

  const masterDataItems: NavItem[] = [
    ...(seesAllDealers(session.role) ? [{ href: '/admin/dealers', label: t('nav.adminDealers') }] : []),
    { href: '/admin/branches', label: t('nav.adminBranches') },
    { href: '/admin/technicians', label: t('nav.adminTechnicians') },
    ...(seesAllDealers(session.role) ? [{ href: '/admin/problem-codes', label: t('nav.adminProblemCodes') }] : []),
    ...(seesAllDealers(session.role) ? [{ href: '/admin/pm-intervals', label: t('nav.adminPmIntervals') }] : []),
    ...(seesAllDealers(session.role) ? [{ href: '/admin/product-families', label: t('nav.adminProductFamilies') }] : []),
    ...(seesAllDealers(session.role) ? [{ href: '/admin/product-family-models', label: t('nav.adminProductFamilyModels') }] : []),
    ...(seesAllDealers(session.role) ? [{ href: '/admin/maintenance-programs', label: t('nav.adminMaintenancePrograms') }] : []),
  ];

  // Audit/Sessions/Settings have no real page yet - named, real gaps
  // (not scaffolded as inert Coming Soon placeholders here, Production
  // Pilot hides them regardless of role - same reasoning as every other
  // removed placeholder above). Historical NTR Import (formerly Legacy
  // Import) and Import History are permanently retired (Product Owner
  // decision, ADR-038, 2026-07-16) - no nav entry, no route, no code path
  // of any kind, not merely hidden for Production Pilot.
  const isAdminRole = canManageUsers(session.role);
  const adminItems: NavItem[] = [
    ...(isAdminRole ? [{ href: '/admin/users', icon: '👥', label: t('nav.adminUsers') }] : []),
    ...(canManageEmailHealth(session.role) ? [{ href: '/admin/email-health', label: t('nav.adminEmailHealth') }] : []),
  ];

  const showMasterData = canManageMasterData(session.role) && masterDataItems.length > 0;
  if (adminItems.length > 0 || showMasterData) {
    groups.push({
      key: 'administration',
      icon: '⚙️',
      label: t('nav.administrationGroup'),
      items: adminItems,
      subgroups: showMasterData ? [{ label: t('nav.masterData'), items: masterDataItems }] : undefined,
    });
  }

  return filterGroupsByCapability(groups, session.role);
}

/** Flattens every *real* (non-Coming-Soon) leaf across every group/subgroup
 *  - used by `PlatformHeader` for its pathname-prefix breadcrumb/title
 *  lookup, which only ever needs to match an actual route. */
export function flattenRealNavItems(groups: NavGroup[]): NavItem[] {
  const out: NavItem[] = [];
  for (const group of groups) {
    for (const item of group.items ?? []) {
      if (item.href) out.push(item);
    }
    for (const sub of group.subgroups ?? []) {
      for (const item of sub.items) {
        if (item.href) out.push(item);
      }
    }
  }
  return out;
}

/** Finds the nav entry whose `href` prefixes the current pathname - used
 *  by `PlatformHeader` to derive the module title/breadcrumb, and by
 *  `Sidebar` to decide which single item to highlight, without either one
 *  keeping its own independently-maintained matching logic.
 *
 *  Picks the *longest* matching `href`, not merely the first one in array
 *  order: `/delivery/pdi` (Incoming PDI) and `/delivery/pdi/dashboard`
 *  (Dashboard MSEAL PDI) are sibling nav items where one happens to be a
 *  path-prefix of the other, so a pathname of `/delivery/pdi/dashboard`
 *  matches both - only the longer, more specific one is the actual active
 *  page. Every other route in this nav has no such sibling-prefix overlap,
 *  so this changes nothing for them. */
export function findActiveNavItem(pathname: string, items: NavItem[]): NavItem | null {
  const matches = items.filter((item): item is NavItem & { href: string } => !!item.href && (pathname === item.href || pathname.startsWith(item.href + '/')));
  if (matches.length === 0) return null;
  return matches.reduce((best, item) => (item.href.length > best.href.length ? item : best));
}

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
 * Freeze): navigation represents available business capability, not the
 * product roadmap. Every leaf has a `CapabilityStatus`; `getNavGroups`
 * shows every status to SuperAdmin (who needs to see the whole roadmap:
 * Coming Soon/Preview/Beta/Development) and only `ACTIVE` leaves to every
 * other role (an unfinished capability is hidden completely, never shown
 * disabled). This is one generic status-driven filter
 * (`isCapabilityVisible`), applied uniformly to every group - there is no
 * per-module special case (e.g. nothing named "Engineering Intelligence"
 * or "Knowledge" anywhere in the filtering logic itself). A group or
 * subgroup left with zero visible items after filtering is omitted
 * entirely, the same "never render an empty container" rule the
 * Administration group already used. This is a UX-visibility rule only -
 * every gated leaf still has `href: null` (no route exists to protect);
 * see `docs/standards/SECURITY_STANDARD.md`'s Application-layer
 * authorization section for how *real* routes are separately enforced
 * server-side regardless of what the nav shows.
 */
import { SessionUser } from '@/lib/types';
import { canManageMasterData, canManageLegacyImport, canManageEmailHealth, canManageUsers, seesAllDealers } from '@/lib/scope';
import type { TranslationVars } from '@/lib/i18n/types';

/**
 * A capability's build/rollout state, independent of who may see it.
 * `ACTIVE` is the only status visible to non-SuperAdmin roles - see
 * `isCapabilityVisible`. The other four all mean "not yet a capability a
 * regular user can act on," kept as distinct labels only because the
 * roadmap badge SuperAdmin sees should say which one it is.
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
 * Navigation Visibility Rule (post-Foundation Freeze refinement):
 * SuperAdmin sees every capability status (the full roadmap); every other
 * role sees only `ACTIVE` capabilities. One generic rule, applied to every
 * leaf regardless of which group/module it belongs to - adding a new
 * future capability (Dealer Portal, IoT, Notifications, ...) at any status
 * other than `ACTIVE` is automatically SuperAdmin-only with no code change
 * here.
 */
export function isCapabilityVisible(item: NavItem, role: SessionUser['role']): boolean {
  if (role === 'SuperAdmin') return true;
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

function comingSoon(icon: string | undefined, label: string): NavItem {
  return { href: null, icon, label, comingSoon: true };
}

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
 * this real capability - e.g. Legacy Import's `canManageLegacyImport`),
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
      key: 'machines',
      icon: '🚜',
      label: t('nav.machinesGroup'),
      items: [
        { href: '/vehicles', label: t('nav.vehicle360') },
        { href: '/machines', label: t('nav.machinePassport') },
        { href: '/ntr', label: t('nav.ntrRecords') },
        ...(canManageLegacyImport(session.role) ? [{ href: '/admin/legacy-import', label: t('nav.legacyImport') }] : []),
      ],
    },
    {
      key: 'service',
      icon: '🔧',
      label: t('nav.serviceGroup'),
      items: [
        { href: '/pm-records', label: t('nav.pmRecords') },
        comingSoon(undefined, t('nav.warranty')),
      ],
      subgroups: [
        {
          label: t('nav.campaigns'),
          items: [
            // Recall removed (UI Terminology & Navigation Cleanup) - no
            // Recall module/data exists and it had no distinct destination
            // from Service Campaign; not carried forward as Coming Soon.
            comingSoon(undefined, t('nav.serviceCampaign')),
            comingSoon(undefined, t('nav.pip')),
          ],
        },
      ],
    },
    {
      // Domain ownership (UI Terminology & Navigation Cleanup, supersedes
      // the ADR-023 addendum's original split): Quality owns Troubleshooting
      // and Quality Cases as operational execution activities - technicians
      // diagnosing an active quality problem. Engineering Intelligence
      // consumes validated Quality/Knowledge/Troubleshooting data to produce
      // analysis and improvement plans; it does not own execution. PIP
      // remains an Engineering Intelligence deliverable (produced from
      // Quality Cases/Knowledge, not owned or duplicated here) - see the
      // `engineering-intelligence` group below. Troubleshooting has exactly
      // one nav entry, here - never a second copy under Engineering
      // Intelligence.
      //
      // Engineering Knowledge Platform (ADR-018): Knowledge flips from
      // Coming Soon to a real route (`/quality/knowledge`) - same item,
      // same label, same position; no nav restructuring. "Knowledge
      // Candidate" and "Knowledge Case" are maturity states of the one
      // Knowledge screen, not separate nav entries. Knowledge OWNS itself
      // (an independent domain, its own tables/service - never owned by
      // Quality, PM, Warranty, or Machine); it sits under this Quality nav
      // group purely for UX/discoverability (the same place a technician
      // already looks for Quality Cases/Troubleshooting), not because
      // Quality owns its data - see `docs/architecture/KNOWLEDGE_PLATFORM.md`
      // §1/§7 (this comment previously implied Quality-ownership by listing
      // Knowledge "alongside Quality Cases," corrected by final architecture
      // review).
      key: 'quality',
      icon: '⚠️',
      label: t('nav.qualityGroup'),
      items: [
        { href: '/quality/dashboard', label: t('nav.qualityDashboard') },
        { href: '/records', label: t('nav.qualityCases') },
        comingSoon(undefined, t('nav.qualityAnalytics')),
        comingSoon(undefined, t('nav.troubleshooting')),
        { href: '/quality/knowledge', label: t('nav.qualityKnowledge') },
      ],
    },
    {
      // Engineering Intelligence exposes only real, distinct business
      // capabilities (UI Terminology & Navigation Cleanup) - AI Engineering,
      // PIP, and Predictive Quality. It consumes Knowledge (an independent
      // domain, not Quality's - see the `quality` group above) and Quality's
      // own Cases/Troubleshooting to produce analysis; it does not own a
      // separate "Knowledge Engine" entry (Knowledge's one nav entry lives
      // under Quality's menu, above, for discoverability only) or a
      // separate Troubleshooting entry (Quality-owned). PIP is produced
      // FROM Quality Cases/Knowledge but is itself an Engineering
      // deliverable, not a Quality one; it has exactly one nav entry, here,
      // not a second copy under Quality.
      key: 'engineering-intelligence',
      icon: '🧠',
      label: t('nav.engineeringIntelligence'),
      items: [
        comingSoon(undefined, t('nav.aiAnalysis')),
        comingSoon(undefined, t('nav.pip')),
        comingSoon(undefined, t('nav.prediction')),
      ],
    },
    {
      // Reports is a cross-cutting capability, not a business domain
      // (architecture refinement, ADR-023 addendum) - it consumes data FROM
      // every domain above (Machines, Service/PM, Warranty, Quality,
      // Engineering Intelligence, Import Platform) rather than owning any
      // data of its own. It gets a nav group because every other cross-
      // cutting concern (Administration) does too, not because it's a
      // domain like Machines/Service/Quality are.
      key: 'reports',
      icon: '📊',
      label: t('nav.reportsGroup'),
      items: [
        comingSoon(undefined, t('nav.reportsExecutive')),
        comingSoon(undefined, t('nav.reportsOperations')),
        comingSoon(undefined, t('nav.reportsDealer')),
        comingSoon(undefined, t('nav.reportsExport')),
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

  // Audit/Sessions/Settings have no real page yet, but are still
  // administrative capabilities - gated behind `canManageUsers` (the same
  // three-role set - SuperAdmin/CentralAdmin/DealerAdmin - as
  // `canManageMasterData`) so a DealerUser never sees an Administration
  // group at all, Coming Soon or not, matching this role's pre-existing
  // "no admin nav" visibility.
  const isAdminRole = canManageUsers(session.role);
  const adminItems: NavItem[] = [
    ...(isAdminRole ? [{ href: '/admin/users', icon: '👥', label: t('nav.adminUsers') }] : []),
    ...(canManageLegacyImport(session.role) ? [{ href: '/admin/import-history', label: t('nav.adminImportHistory') }] : []),
    ...(isAdminRole ? [comingSoon(undefined, t('nav.adminAudit')), comingSoon(undefined, t('nav.adminSessions'))] : []),
    ...(canManageEmailHealth(session.role) ? [{ href: '/admin/email-health', label: t('nav.adminEmailHealth') }] : []),
    ...(isAdminRole ? [comingSoon(undefined, t('nav.adminSettings'))] : []),
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
 *  by `PlatformHeader` to derive the module title/breadcrumb without a
 *  second, independently-maintained title list. */
export function findActiveNavItem(pathname: string, items: NavItem[]): NavItem | null {
  return items.find((item) => item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))) ?? null;
}

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
 */
import { SessionUser } from '@/lib/types';
import { canManageMasterData, canManageLegacyImport, canManageEmailHealth, canManageUsers, seesAllDealers } from '@/lib/scope';
import type { TranslationVars } from '@/lib/i18n/types';

export interface NavItem {
  /** `null` for a Coming Soon placeholder - never a fake/broken route. */
  href: string | null;
  icon?: string;
  label: string;
  comingSoon?: boolean;
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

/**
 * The platform's full navigation tree, role-filtered. Every group with no
 * visible items for the current role is omitted entirely (never rendered
 * empty) - `Sidebar` doesn't need its own visibility logic beyond that.
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
        comingSoon(undefined, t('nav.machinePassport')),
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
            comingSoon(undefined, t('nav.recall')),
            comingSoon(undefined, t('nav.serviceCampaign')),
            comingSoon(undefined, t('nav.pip')),
          ],
        },
      ],
    },
    {
      // Product Improvement Plan (PIP) does NOT live here (architecture
      // refinement, ADR-023 addendum) - PIP is an Engineering activity, not
      // a Quality one: Quality Cases -> Knowledge -> Engineering Analysis ->
      // PIP -> Recall. See the `engineering-intelligence` group below.
      // Quality *produces* the Cases a PIP is built from but does not own
      // or duplicate the PIP page/nav entry itself.
      key: 'quality',
      icon: '⚠️',
      label: t('nav.qualityGroup'),
      items: [
        { href: '/quality/dashboard', label: t('nav.qualityDashboard') },
        { href: '/records', label: t('nav.qualityCases') },
        comingSoon(undefined, t('nav.qualityAnalytics')),
        comingSoon(undefined, t('nav.qualityKnowledge')),
      ],
    },
    {
      // Owns the Knowledge -> Engineering Analysis -> PIP -> Recall chain
      // (architecture refinement, ADR-023 addendum) - PIP is produced FROM
      // Quality Cases/Knowledge but is itself an Engineering deliverable,
      // not a Quality one; it has exactly one nav entry, here, not a second
      // copy under Quality.
      key: 'engineering-intelligence',
      icon: '🧠',
      label: t('nav.engineeringIntelligence'),
      items: [
        comingSoon(undefined, t('nav.knowledgeEngine')),
        comingSoon(undefined, t('nav.troubleshooting')),
        comingSoon(undefined, t('nav.aiAnalysis')),
        comingSoon(undefined, t('nav.prediction')),
        comingSoon(undefined, t('nav.pip')),
        comingSoon(undefined, t('nav.insights')),
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

  return groups;
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

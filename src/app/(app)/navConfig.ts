/**
 * Single source of truth for the app's navigation entries - consumed by
 * both `Sidebar` (desktop aside + mobile drawer) and `PlatformHeader`
 * (breadcrumb/module-title lookup), so there is exactly one nav list, not
 * two independently maintained ones. Icons follow
 * `docs/standards/DOMAIN_LANGUAGE_STANDARD.md`'s Official Menu Standard
 * table - only modules that actually exist today get an entry;
 * PDI/Campaign/Warranty/Parts/Reports are defined by the standard for
 * future modules and are intentionally not added here.
 */
import { SessionUser } from '@/lib/types';
import { canManageMasterData, canManageLegacyImport, seesAllDealers } from '@/lib/scope';
import type { TranslationVars } from '@/lib/i18n/types';

export interface NavItem {
  href: string;
  icon?: string;
  label: string;
}

type Translate = (key: string, vars?: TranslationVars) => string;

export function getPrimaryNav(t: Translate): NavItem[] {
  return [
    { href: '/dashboard', icon: '🏠', label: t('nav.dashboard') },
    { href: '/report', icon: '⚠️', label: t('nav.newReport') },
    { href: '/records', icon: '⚠️', label: t('nav.mqrRecords') },
    { href: '/pm-records', icon: '🔧', label: t('nav.pmRecords') },
    { href: '/ntr', icon: '📝', label: t('nav.ntrRecords') },
    { href: '/vehicles', icon: '🚜', label: t('nav.vehicle360') },
  ];
}

export function getAdminNav(t: Translate, session: SessionUser): NavItem[] {
  const showDealers = seesAllDealers(session.role);
  return [
    ...(showDealers ? [{ href: '/admin/dealers', label: t('nav.adminDealers') }] : []),
    { href: '/admin/branches', label: t('nav.adminBranches') },
    { href: '/admin/technicians', label: t('nav.adminTechnicians') },
    ...(showDealers ? [{ href: '/admin/problem-codes', label: t('nav.adminProblemCodes') }] : []),
    ...(showDealers ? [{ href: '/admin/pm-intervals', label: t('nav.adminPmIntervals') }] : []),
    ...(showDealers ? [{ href: '/admin/product-families', label: t('nav.adminProductFamilies') }] : []),
    ...(showDealers ? [{ href: '/admin/product-family-models', label: t('nav.adminProductFamilyModels') }] : []),
    ...(showDealers ? [{ href: '/admin/maintenance-programs', label: t('nav.adminMaintenancePrograms') }] : []),
    { href: '/admin/users', icon: '👥', label: t('nav.adminUsers') },
  ];
}

export function showMasterDataNav(session: SessionUser): boolean {
  return canManageMasterData(session.role);
}

export function showLegacyImportNav(session: SessionUser): boolean {
  return canManageLegacyImport(session.role);
}

/** Finds the nav entry whose `href` prefixes the current pathname - used
 *  by `PlatformHeader` to derive the module title/breadcrumb without a
 *  second, independently-maintained title list. */
export function findActiveNavItem(pathname: string, items: NavItem[]): NavItem | null {
  return items.find((item) => pathname === item.href || pathname.startsWith(item.href + '/')) ?? null;
}

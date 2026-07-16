'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SessionUser } from '@/lib/types';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { APP_NAME } from '@/lib/branding';
import { getNavGroups, effectiveStatus, flattenRealNavItems, findActiveNavItem, NavItem } from './navConfig';

export interface SidebarProps {
  session: SessionUser;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ session, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const groups = getNavGroups(t, session);
  // Single source of truth with PlatformHeader's own breadcrumb lookup -
  // picks the one most-specific matching route so sibling items whose
  // hrefs happen to be path-prefixes of each other (e.g. Incoming PDI
  // `/delivery/pdi` and Dashboard MSEAL PDI `/delivery/pdi/dashboard`)
  // never both highlight at once (see `findActiveNavItem`'s own doc
  // comment).
  const activeHref = findActiveNavItem(pathname, flattenRealNavItems(groups))?.href ?? null;

  function NavLink(item: NavItem) {
    const { href, icon, label } = item;
    // Only reachable for SuperAdmin - every other role never receives a
    // non-ACTIVE leaf from `getNavGroups` in the first place (Navigation
    // Visibility Rule, navConfig.ts). SuperAdmin still sees it rendered
    // disabled, with a badge, rather than as a broken/fake link.
    if (effectiveStatus(item) !== 'ACTIVE' || !href) {
      return (
        <div
          aria-disabled="true"
          title={t('nav.comingSoon')}
          className="flex items-center justify-between px-3 py-2 rounded text-sm text-white/30 cursor-not-allowed select-none"
        >
          <span>
            {icon && <span className="mr-2">{icon}</span>}
            {label}
          </span>
          <span className="text-[10px] uppercase tracking-wide border border-white/20 rounded px-1 py-0.5 shrink-0 ml-2">
            {t('nav.comingSoon')}
          </span>
        </div>
      );
    }
    const active = href === activeHref;
    return (
      <Link
        href={href}
        onClick={onClose}
        className={`block px-3 py-2 rounded text-sm transition ${
          active ? 'bg-gradient-primary text-white shadow-glow' : 'text-white/80 hover:bg-white/10'
        }`}
      >
        {icon && <span className="mr-2">{icon}</span>}
        {label}
      </Link>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 print:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 h-screen md:h-auto bg-brand-dark text-white flex flex-col shrink-0 print:hidden transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between md:hidden">
          <div className="font-bold text-white text-sm">{APP_NAME}</div>
          <button
            onClick={onClose}
            aria-label={t('nav.closeMenu')}
            className="p-1 text-white/60 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.key} className="pt-3 first:pt-0">
              <div className="px-3 pb-1 text-[11px] uppercase tracking-wide text-white/40">
                {group.icon} {group.label}
              </div>
              {(group.items ?? []).map((item) => (
                <NavLink key={item.href ?? item.label} {...item} />
              ))}
              {(group.subgroups ?? []).map((sub) => (
                <div key={sub.label} className="mt-1">
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-white/30">{sub.label}</div>
                  <div className="pl-2">
                    {sub.items.map((item) => (
                      <NavLink key={item.href ?? item.label} {...item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

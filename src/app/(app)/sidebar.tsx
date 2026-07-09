'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SessionUser } from '@/lib/types';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { getPrimaryNav, getAdminNav, showMasterDataNav, showLegacyImportNav } from './navConfig';

export interface SidebarProps {
  session: SessionUser;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ session, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const showMasterData = showMasterDataNav(session);
  // Legacy Import is hidden completely from every role except Super
  // Administrator - not just visually de-emphasized. Every route it calls
  // re-checks this same predicate server-side; hiding the menu entry is
  // UX only, never the actual enforcement (see
  // docs/standards/SECURITY_STANDARD.md §Application-layer authorization).
  const showLegacyImport = showLegacyImportNav(session);

  const NAV = getPrimaryNav(t);
  const adminNav = getAdminNav(t, session);

  function NavLink({ href, icon, label }: { href: string; icon?: string; label: string }) {
    const active = pathname === href || pathname.startsWith(href + '/');
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
          <div className="font-bold text-white text-sm">MSEAL DMS</div>
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
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          {showMasterData && (
            <>
              <div className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">⚙️ {t('nav.masterData')}</div>
              {adminNav.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </>
          )}
          {showLegacyImport && (
            <>
              <div className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">🔧 {t('nav.systemSettings')}</div>
              <NavLink href="/admin/legacy-import" label={t('nav.legacyImport')} />
            </>
          )}
        </nav>
      </aside>
    </>
  );
}

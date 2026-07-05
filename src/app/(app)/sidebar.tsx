'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SessionUser } from '@/lib/types';
import { canManageMasterData, canManageLegacyImport, seesAllDealers } from '@/lib/scope';
import { useTranslation } from '@/lib/i18n/LocaleProvider';

export default function Sidebar({ session }: { session: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const showMasterData = canManageMasterData(session.role);
  const showDealers = seesAllDealers(session.role);
  // Legacy Import is hidden completely from every role except Super
  // Administrator - not just visually de-emphasized. Every route it calls
  // re-checks this same predicate server-side; hiding the menu entry is
  // UX only, never the actual enforcement (see
  // docs/standards/SECURITY_STANDARD.md §Application-layer authorization).
  const showLegacyImport = canManageLegacyImport(session.role);

  // Icons follow docs/standards/DOMAIN_LANGUAGE_STANDARD.md's Official Menu
  // Standard table - only modules that actually exist today get an entry;
  // PDI/Campaign/Warranty/Parts/Reports are defined by the standard for
  // future modules and are intentionally not added here.
  const NAV = [
    { href: '/dashboard', icon: '🏠', label: t('nav.dashboard') },
    { href: '/report', icon: '⚠️', label: t('nav.newReport') },
    { href: '/records', icon: '⚠️', label: t('nav.mqrRecords') },
    { href: '/pm-records', icon: '🔧', label: t('nav.pmRecords') },
    { href: '/ntr', icon: '📝', label: t('nav.ntrRecords') },
    { href: '/vehicles', icon: '🚜', label: t('nav.vehicle360') },
  ];

  const adminNav = [
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

  function NavLink({ href, icon, label }: { href: string; icon?: string; label: string }) {
    const active = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
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
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-brand-dark text-white px-4 py-3 print:hidden sticky top-0 z-30">
        <div className="font-bold text-white text-sm">
          Mahindra <span className="text-brand-red">After-Sales</span> Platform
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label={t('nav.openMenu')}
          className="p-2 rounded hover:bg-white/10 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 print:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 h-screen md:h-auto bg-brand-dark text-white flex flex-col shrink-0 print:hidden transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-white/10 flex items-start justify-between">
          <div>
            <div className="font-bold text-white">
              MSEAL <span className="text-brand-red">After-Sales</span> Platform
            </div>
            <div className="text-xs text-white/70 mt-2">{session.fullName}</div>
            <div className="text-xs text-white/40">
              {t(`role.${session.role}`)}
              {session.dealerId ? ` · ${session.dealerId}` : ''}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label={t('nav.closeMenu')}
            className="md:hidden p-1 text-white/60 hover:text-white"
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
        <button onClick={logout} className="m-2 px-3 py-2 rounded text-sm text-white/80 hover:bg-white/10 text-left">
          {t('nav.logout')}
        </button>
      </aside>
    </>
  );
}

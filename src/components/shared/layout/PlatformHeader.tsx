'use client';

/**
 * The ONE shared Platform Header - sticky, responsive, identical on every
 * authenticated page. Left: logo, current module title, breadcrumb.
 * Right: language selector, notification placeholder, user/role/dealer/
 * branch, user menu (logout). Replaces `Sidebar`'s own hand-rolled mobile
 * top bar (removed) so there is exactly one header, not two.
 *
 * Presentational only - the mobile drawer's open/close state is owned by
 * `AppShell`, passed in as `onOpenMenu`.
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SessionUser } from '@/lib/types';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import LanguageSelector from '@/components/shared/i18n/LanguageSelector';
import NotificationBell from '@/components/shared/layout/NotificationBell';
import { getPrimaryNav, getAdminNav, findActiveNavItem } from '@/app/(app)/navConfig';

export interface PlatformHeaderProps {
  session: SessionUser;
  dealerName?: string | null;
  branchName?: string | null;
  onOpenMenu: () => void;
}

export default function PlatformHeader({ session, dealerName, branchName, onOpenMenu }: PlatformHeaderProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const navItems = [...getPrimaryNav(t), ...getAdminNav(t, session)];
  const activeItem = findActiveNavItem(pathname, navItems);
  const moduleTitle = activeItem?.label ?? t('nav.dashboard');

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-brand-dark text-white px-3 sm:px-4 py-2.5 print:hidden shadow-card">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMenu}
          aria-label={t('nav.openMenu')}
          className="md:hidden p-2 -ml-1 rounded hover:bg-white/10 transition shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="font-bold text-sm sm:text-base shrink-0 hidden sm:block">
          MSEAL DMS <span className="text-brand-red">•</span>
        </div>

        <nav aria-label="Breadcrumb" className="min-w-0 flex items-center gap-1.5 text-sm text-white/90 truncate">
          <span className="text-white/50 hidden sm:inline">/</span>
          <span className="font-semibold truncate">{moduleTitle}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <LanguageSelector variant="header" />

        <NotificationBell
          label={t('common.notifications')}
          comingSoonLabel={t('common.notificationsComingSoon')}
          className="hidden sm:inline-flex"
        />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 pl-2 pr-3 py-1.5 transition"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-red text-[11px] font-bold uppercase">
              {session.fullName.slice(0, 1)}
            </span>
            <span className="hidden md:flex flex-col items-start leading-tight text-left">
              <span className="text-xs font-semibold truncate max-w-[10rem]">{session.fullName}</span>
              <span className="text-[10px] text-white/60 truncate max-w-[10rem]">
                {t(`role.${session.role}`)}
                {dealerName ? ` · ${dealerName}` : session.dealerId ? ` · ${session.dealerId}` : ''}
                {branchName ? ` · ${branchName}` : ''}
              </span>
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-3 w-3 transition-transform hidden md:block ${menuOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            role="menu"
            className={`absolute right-0 mt-1.5 w-56 rounded-xl bg-white shadow-card border border-gray-200 overflow-hidden origin-top-right transition-all duration-200 z-50 text-gray-800 ${
              menuOpen ? 'opacity-100 scale-y-100 translate-y-0' : 'opacity-0 scale-y-95 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="px-3 py-2.5 border-b border-gray-100 md:hidden">
              <div className="text-xs font-semibold truncate">{session.fullName}</div>
              <div className="text-[11px] text-gray-500 truncate">
                {t(`role.${session.role}`)}
                {dealerName ? ` · ${dealerName}` : ''}
                {branchName ? ` · ${branchName}` : ''}
              </div>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

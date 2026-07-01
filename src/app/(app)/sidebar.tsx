'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SessionUser } from '@/lib/types';
import { roleLabelTh, canManageMasterData, seesAllDealers } from '@/lib/scope';

const NAV = [
  { href: '/dashboard', label: 'หน้าหลัก' },
  { href: '/report', label: 'รายงานปัญหาคุณภาพ' },
  { href: '/records', label: 'ติดตามรายงานปัญหาคุณภาพ' },
  { href: '/pm-records', label: 'บำรุงรักษาเชิงป้องกัน' },
  { href: '/vehicles', label: 'Vehicle 360' },
];

export default function Sidebar({ session }: { session: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const showMasterData = canManageMasterData(session.role);
  const showDealers = seesAllDealers(session.role);

  const adminNav = [
    ...(showDealers ? [{ href: '/admin/dealers', label: 'ดีลเลอร์' }] : []),
    { href: '/admin/branches', label: 'สาขา' },
    { href: '/admin/technicians', label: 'ช่างซ่อม' },
    ...(showDealers ? [{ href: '/admin/problem-codes', label: 'หมวดปัญหา/อาการเสีย' }] : []),
    ...(showDealers ? [{ href: '/admin/pm-intervals', label: 'รอบ PM' }] : []),
    ...(showDealers ? [{ href: '/admin/pm-programs', label: 'PM Program' }] : []),
    { href: '/admin/users', label: 'ผู้ใช้งาน' },
  ];

  function NavLink({ href, label }: { href: string; label: string }) {
    const active = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={`block px-3 py-2 rounded text-sm transition ${
          active ? 'bg-gradient-primary text-white shadow-glow' : 'text-white/80 hover:bg-white/10'
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-brand-dark text-white px-4 py-3 print:hidden sticky top-0 z-30">
        <div className="font-bold text-white text-sm">
          Market <span className="text-brand-red">Quality</span> Report
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
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
              Market <span className="text-brand-red">Quality</span> Report
            </div>
            <div className="text-xs text-white/70 mt-2">{session.fullName}</div>
            <div className="text-xs text-white/40">
              {roleLabelTh[session.role]}
              {session.dealerId ? ` · ${session.dealerId}` : ''}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="ปิดเมนู"
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
              <div className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide text-white/40">จัดการข้อมูลหลัก</div>
              {adminNav.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </>
          )}
        </nav>
        <button onClick={logout} className="m-2 px-3 py-2 rounded text-sm text-white/80 hover:bg-white/10 text-left">
          ออกจากระบบ
        </button>
      </aside>
    </>
  );
}

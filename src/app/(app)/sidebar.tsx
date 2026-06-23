'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SessionUser } from '@/lib/types';
import { roleLabelTh } from '@/lib/scope';

const NAV = [
  { href: '/dashboard', label: 'หน้าหลัก' },
  { href: '/report', label: 'แจ้งซ่อม' },
  { href: '/records', label: 'ตรวจสอบสถานะรับซ่อม' },
];

export default function Sidebar({ session }: { session: SessionUser }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-64 bg-brand-dark text-white flex flex-col shrink-0">
      <div className="p-4 border-b border-white/10">
        <div className="font-bold text-white">
          Market <span className="text-brand-red">Quality</span> Report
        </div>
        <div className="text-xs text-white/70 mt-2">{session.fullName}</div>
        <div className="text-xs text-white/40">
          {roleLabelTh[session.role]}
          {session.dealerId ? ` · ${session.dealerId}` : ''}
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm transition ${
                active ? 'bg-brand-red text-white' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={logout}
        className="m-2 px-3 py-2 rounded text-sm text-white/80 hover:bg-white/10 text-left"
      >
        ออกจากระบบ
      </button>
    </aside>
  );
}

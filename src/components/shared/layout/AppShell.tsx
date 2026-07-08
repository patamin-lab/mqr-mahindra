'use client';

/**
 * Owns the one piece of state `PlatformHeader` (mobile hamburger) and
 * `Sidebar` (mobile drawer) both need to agree on - whether the mobile
 * nav drawer is open - so there is exactly one header and one sidebar,
 * never a second copy each managing its own open/close state.
 */
import { useState } from 'react';
import { SessionUser } from '@/lib/types';
import PlatformHeader from './PlatformHeader';
import Sidebar from '@/app/(app)/sidebar';

export interface AppShellProps {
  session: SessionUser;
  dealerName?: string | null;
  branchName?: string | null;
  children: React.ReactNode;
}

export default function AppShell({ session, dealerName, branchName, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <PlatformHeader
        session={session}
        dealerName={dealerName}
        branchName={branchName}
        onOpenMenu={() => setDrawerOpen(true)}
      />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar session={session} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDealer, getBranchById } from '@/lib/db';
import AppShell from '@/components/shared/layout/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const [dealer, branch] = await Promise.all([
    session.dealerId ? getDealer(session.dealerId) : Promise.resolve(null),
    session.branchId ? getBranchById(session.branchId) : Promise.resolve(null),
  ]);

  return (
    <AppShell session={session} dealerName={dealer?.short_name} branchName={branch?.name}>
      {children}
    </AppShell>
  );
}

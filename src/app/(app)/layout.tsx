import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';
import AppShell from '@/components/shared/layout/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const [dealer, branch] = await Promise.all([
    session.dealerId ? MasterDataService.getDealerById(session.dealerId) : Promise.resolve(null),
    session.branchId ? MasterDataService.getBranch(session.branchId) : Promise.resolve(null),
  ]);

  return (
    <AppShell session={session} dealerName={dealer?.short_name} branchName={branch?.name}>
      {children}
    </AppShell>
  );
}

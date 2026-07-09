import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllBranchesAdmin, listAllDealersAdmin } from '@/lib/db';
import { canManageMasterData, seesAllDealers } from '@/lib/scope';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import BranchesTable from './branches-table';

export default async function BranchesAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canManageMasterData(session.role)) redirect('/dashboard');

  const { dealerId, unrestricted } = resolveDealerScope(session, null);
  const branches = await listAllBranchesAdmin(dealerId);
  const dealers = seesAllDealers(session.role) ? await listAllDealersAdmin() : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">จัดการสาขา</h1>
      <BranchesTable initialBranches={branches} dealers={dealers} lockedDealerId={unrestricted ? null : dealerId} />
    </div>
  );
}

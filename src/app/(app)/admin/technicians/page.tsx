import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllTechniciansAdmin, listAllDealersAdmin } from '@/lib/db';
import { canManageMasterData, seesAllDealers } from '@/lib/scope';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import TechniciansTable from './technicians-table';

export default async function TechniciansAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canManageMasterData(session.role)) redirect('/dashboard');

  const { dealerId, unrestricted } = resolveDealerScope(session, null);
  const technicians = await listAllTechniciansAdmin(dealerId);
  const dealers = seesAllDealers(session.role) ? await listAllDealersAdmin() : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">จัดการช่างซ่อม</h1>
      <TechniciansTable
        initialTechnicians={technicians}
        dealers={dealers}
        lockedDealerId={unrestricted ? null : dealerId}
      />
    </div>
  );
}

import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';
import { seesAllDealers } from '@/lib/scope';
import MaintenanceHistory from '@/features/maintenance/components/maintenance-history';

export default async function PmRecordsPage() {
  const session = await getSession();
  if (!session) return null;

  const showDealerField = seesAllDealers(session.role);
  const dealers = showDealerField ? await MasterDataService.getDealers() : [];
  const pinnedBranch = session.role === 'DealerUser' && session.branchId ? await MasterDataService.getBranch(session.branchId) : null;

  return (
    <MaintenanceHistory
      dealers={dealers}
      showDealerField={showDealerField}
      defaultDealerId={showDealerField ? null : session.dealerId}
      username={session.username}
      role={session.role}
      sessionBranchId={session.branchId}
      pinnedBranchName={pinnedBranch?.name ?? null}
    />
  );
}

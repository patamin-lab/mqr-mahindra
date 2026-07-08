import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';
import { seesAllDealers } from '@/lib/scope';
import MaintenanceSearch from '@/features/maintenance/components/maintenance-search';

export default async function PmRecordNewPage() {
  const session = await getSession();
  if (!session) return null;

  const showDealerField = seesAllDealers(session.role);
  const dealers = showDealerField ? await MasterDataService.getDealers() : [];
  const pinnedDealer = !showDealerField && session.dealerId ? await MasterDataService.getDealerById(session.dealerId) : null;
  const pinnedBranch = session.role === 'DealerUser' && session.branchId ? await MasterDataService.getBranch(session.branchId) : null;

  return (
    <MaintenanceSearch
      dealers={dealers}
      role={session.role}
      sessionDealerId={session.dealerId}
      sessionBranchId={session.branchId}
      pinnedDealerName={pinnedDealer?.short_name}
      pinnedBranchName={pinnedBranch?.name}
    />
  );
}

import { getSession } from '@/lib/auth';
import { listDealers, getDealer, getBranchById } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import NtrSearch from '@/features/ntr/components/ntr-search';

export default async function NtrNewPage() {
  const session = await getSession();
  if (!session) return null;

  const showDealerField = seesAllDealers(session.role);
  const dealers = showDealerField ? await listDealers() : [];
  const pinnedDealer = !showDealerField && session.dealerId ? await getDealer(session.dealerId) : null;
  const pinnedBranch = session.role === 'DealerUser' && session.branchId ? await getBranchById(session.branchId) : null;

  return (
    <NtrSearch
      dealers={dealers}
      role={session.role}
      sessionDealerId={session.dealerId}
      sessionBranchId={session.branchId}
      pinnedDealerName={pinnedDealer?.short_name}
      pinnedBranchName={pinnedBranch?.name}
    />
  );
}

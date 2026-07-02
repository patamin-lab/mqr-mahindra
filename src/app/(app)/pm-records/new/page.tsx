import { getSession } from '@/lib/auth';
import { listDealers } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import MaintenanceSearch from '@/features/maintenance/components/maintenance-search';

export default async function PmRecordNewPage() {
  const session = await getSession();
  if (!session) return null;

  const showDealerField = seesAllDealers(session.role);
  const dealers = showDealerField ? await listDealers() : [];

  return (
    <MaintenanceSearch
      dealers={dealers}
      showDealerField={showDealerField}
      defaultDealerId={showDealerField ? null : session.dealerId}
    />
  );
}

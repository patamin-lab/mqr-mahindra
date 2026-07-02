import { getSession } from '@/lib/auth';
import { listDealers } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import MaintenanceHistory from '@/features/maintenance/components/maintenance-history';

export default async function PmRecordsPage() {
  const session = await getSession();
  if (!session) return null;

  const showDealerField = seesAllDealers(session.role);
  const dealers = showDealerField ? await listDealers() : [];

  return (
    <MaintenanceHistory
      dealers={dealers}
      showDealerField={showDealerField}
      defaultDealerId={showDealerField ? null : session.dealerId}
      username={session.username}
    />
  );
}

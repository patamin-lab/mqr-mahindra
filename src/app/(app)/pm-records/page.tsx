import { getSession } from '@/lib/auth';
import { listDealers } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import PmRecordHistory from '@/features/pm-record/pm-record-history';

export default async function PmRecordsPage() {
  const session = await getSession();
  if (!session) return null;

  const showDealerField = seesAllDealers(session.role);
  const dealers = showDealerField ? await listDealers() : [];

  return (
    <PmRecordHistory
      dealers={dealers}
      showDealerField={showDealerField}
      defaultDealerId={showDealerField ? null : session.dealerId}
      username={session.username}
    />
  );
}

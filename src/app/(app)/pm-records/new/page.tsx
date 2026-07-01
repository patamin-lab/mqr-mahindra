import { getSession } from '@/lib/auth';
import { listDealers } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import PmRecordSearch from '@/features/pm-record/pm-record-search';

export default async function PmRecordNewPage() {
  const session = await getSession();
  if (!session) return null;

  const showDealerField = seesAllDealers(session.role);
  const dealers = showDealerField ? await listDealers() : [];

  return (
    <PmRecordSearch
      dealers={dealers}
      showDealerField={showDealerField}
      defaultDealerId={showDealerField ? null : session.dealerId}
    />
  );
}

import { getSession } from '@/lib/auth';
import { listDealers } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import NtrSearch from '@/features/ntr/components/ntr-search';

export default async function NtrNewPage() {
  const session = await getSession();
  if (!session) return null;

  const showDealerField = seesAllDealers(session.role);
  const dealers = showDealerField ? await listDealers() : [];

  return <NtrSearch dealers={dealers} showDealerField={showDealerField} defaultDealerId={showDealerField ? null : session.dealerId} />;
}

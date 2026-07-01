import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import PmRecordForm from '@/features/pm-record/pm-record-form';

export default async function PmRecordNewPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-dark">New PM Record</h1>
        <p className="text-sm text-gray-500">Create a preventive maintenance record.</p>
      </div>
      <PmRecordForm mode="create" showDealerField={seesAllDealers(session.role)} />
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import PmRecordForm from './pm-record-form';

/**
 * PM Records page — Sprint 11.1: Vehicle Lookup.
 *
 * Vehicle autocomplete is live, backed by /api/vehicles/list and
 * /api/vehicles/[serial]. Selecting a vehicle populates Serial, Model,
 * and Delivery Date snapshot fields instantly.
 *
 * CRUD (save / submit) is pending the pm_records database migration
 * (Sprint 11.2). The submit button is disabled until then.
 */
export default async function PmRecordsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold text-brand-dark">บำรุงรักษาเชิงป้องกัน</h1>
      <PmRecordForm lockedDealerId={session.dealerId} />
    </div>
  );
}

import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { fetchMaintenance } from '@/features/maintenance/utils/fetchMaintenance';
import MaintenanceForm from '@/features/maintenance/components/maintenance-form';

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function PmRecordEditPage({ params }: RouteParams) {
  const session = await getSession();
  if (!session) return null;

  const result = await fetchMaintenance(params.id);

  if ('notFound' in result && result.notFound) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-brand-dark">Edit PM Record</h1>
            <p className="text-sm text-gray-500">Record ID: {params.id}</p>
          </div>
          <Link href="/pm-records" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
            Back to List
          </Link>
        </div>

        <div className="rounded border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p>Record not found.</p>
        </div>
      </div>
    );
  }

  if ('error' in result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-brand-dark">Edit PM Record</h1>
            <p className="text-sm text-gray-500">Record ID: {params.id}</p>
          </div>
          <Link href="/pm-records" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
            Back to List
          </Link>
        </div>

        <div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">
          <p>Error: {result.error}</p>
        </div>
      </div>
    );
  }

  if (!('record' in result)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-brand-dark">Edit PM Record</h1>
            <p className="text-sm text-gray-500">Record ID: {params.id}</p>
          </div>
          <Link href="/pm-records" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
            Back to List
          </Link>
        </div>

        <div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">
          <p>Unexpected error loading record.</p>
        </div>
      </div>
    );
  }

  const record = result.record;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">Edit PM Record</h1>
          <p className="text-sm text-gray-500">Record ID: {record.id}</p>
        </div>
        <Link
          href={`/pm-records/${encodeURIComponent(record.id)}`}
          className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Back to Detail
        </Link>
      </div>

      <MaintenanceForm
        mode="edit"
        recordId={record.id}
        showDealerField={seesAllDealers(session.role)}
        initial={{
          dealer_id: record.dealer_id,
          branch_id: record.branch_id,
          serial: record.serial,
          technician_id: record.technician_id,
          scheduled_date: record.scheduled_date,
          performed_date: record.performed_date,
          status: record.status,
          notes: record.notes,
        }}
      />
    </div>
  );
}

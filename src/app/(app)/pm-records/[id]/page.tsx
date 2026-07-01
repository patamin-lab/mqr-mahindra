import Link from 'next/link';
import { fetchPmRecord } from '@/features/pm-record/fetchPmRecord';

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function PmRecordDetailPage({ params }: RouteParams) {
  const result = await fetchPmRecord(params.id);

  if ('notFound' in result && result.notFound) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-brand-dark">PM Record Detail</h1>
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
            <h1 className="text-xl font-bold text-brand-dark">PM Record Detail</h1>
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
            <h1 className="text-xl font-bold text-brand-dark">PM Record Detail</h1>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">PM Record Detail</h1>
          <p className="text-sm text-gray-500">Record ID: {params.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/pm-records/${encodeURIComponent(record.id)}/edit`}
            className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark"
          >
            Edit
          </Link>
          <Link href="/pm-records" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            Back to List
          </Link>
        </div>
      </div>

      <div className="space-y-4 rounded border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="ID" value={record.id} />
          <DetailRow label="Dealer ID" value={record.dealer_id} />
          <DetailRow label="Branch ID" value={record.branch_id ?? 'N/A'} />
          <DetailRow label="Serial" value={record.serial ?? 'N/A'} />
          <DetailRow label="Technician ID" value={record.technician_id ?? 'N/A'} />
          <DetailRow label="Status" value={record.status} />
          <DetailRow label="Scheduled Date" value={record.scheduled_date ?? 'N/A'} />
          <DetailRow label="Performed Date" value={record.performed_date ?? 'N/A'} />
          <DetailRow label="Created By" value={record.created_by ?? 'N/A'} />
          <DetailRow label="Created At" value={record.created_at} />
          <DetailRow label="Updated By" value={record.updated_by ?? 'N/A'} />
          <DetailRow label="Updated At" value={record.updated_at} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-brand-dark">Notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{record.notes ?? 'No notes available.'}</p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-900">{value}</p>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PmRecord } from '@/features/pm-record/types';

export default function PmRecordsPage() {
  const [records, setRecords] = useState<PmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadRecords() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/pm-records', { credentials: 'same-origin' });
      if (!response.ok) {
        const payload = await response.json();
        const message =
          (typeof payload?.error === 'string' ? payload.error : payload?.error?.message) ||
          'Failed to load PM records';
        setError(message);
        setRecords([]);
      } else {
        const payload = await response.json();
        setRecords(payload.data ?? []);
      }
    } catch (err) {
      setError('Unable to load PM records.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">PM Records</h1>
          <p className="text-sm text-gray-500">Preventive maintenance records list.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pm-records/new"
            className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark"
          >
            + New
          </Link>
          <button
            type="button"
            onClick={loadRecords}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading records…</p>}

      {error && !loading && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <p>Error: {error}</p>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-500">No PM records found.</p>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div className="space-y-3">
          {records.map((record) => (
            <Link
              key={record.id}
              href={`/pm-records/${encodeURIComponent(record.id)}`}
              className="block rounded border border-gray-200 p-4 hover:border-brand-red hover:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-brand-dark">{record.serial ?? record.id}</p>
                  <p className="text-sm text-gray-500">Dealer: {record.dealer_id}</p>
                </div>
                <span className="rounded bg-gray-100 px-2 py-1 text-xs uppercase text-gray-600">{record.status}</span>
              </div>
              <div className="mt-2 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                <p>Branch: {record.branch_id ?? 'N/A'}</p>
                <p>Technician: {record.technician_id ?? 'N/A'}</p>
                <p>Scheduled: {record.scheduled_date ?? 'N/A'}</p>
                <p>Performed: {record.performed_date ?? 'N/A'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

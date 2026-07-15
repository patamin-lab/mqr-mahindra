import Link from 'next/link';
import Card from '@/components/shared/layout/Card';
import { t } from '@/lib/i18n/server';
import type { NtrRecord } from '@/features/ntr/types';

/**
 * Vehicle 360 (ADR-030) - NTR section. `ntrRecords` is the same
 * `fetchNtrRecordsForSerial()` read every other cross-module section on
 * this page already reuses (`MachineService.getMachineNtrHistory()`) -
 * no NTR data is duplicated here, only linked out to `/ntr/[id]` for full
 * detail.
 */
export default function MachineNtrPanel({ ntrRecords }: { ntrRecords: NtrRecord[] }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="ntr">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.ntrTitle')}</h2>
      {ntrRecords.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{t('machinePassport.noNtrHistory')}</p>
      ) : (
        <ul className="space-y-2">
          {ntrRecords.map((record) => (
            <li key={record.id} className="rounded border border-gray-100 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/ntr/${encodeURIComponent(record.id)}`} className="font-medium text-brand-red hover:underline">
                  {record.ntr_number}
                </Link>
                <span className="text-xs text-gray-500">{record.delivery_date ?? 'N/A'}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {record.customer_name} · {record.dealer_id} · {record.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

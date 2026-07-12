import Link from 'next/link';
import Card from '@/components/shared/layout/Card';
import { t } from '@/lib/i18n/server';
import { MachineRelatedRecord } from '../types';

const MODULE_LABEL_KEY: Record<MachineRelatedRecord['module'], string> = {
  mqr: 'common.mqr',
  pm: 'common.pm',
  ntr: 'nav.ntrRecords',
};

/**
 * Machine Digital Passport v1.1/v1.2 refinement - Related Records panel.
 * A flat, cross-module list of every MQR/PM/NTR record already known to
 * belong to this machine (same records Warranty/PM/Quality/Activity read
 * independently), split into Open/History (v1.2) using the `bucket`
 * classification `MachineService.getMachineRelatedRecords()` already
 * computed via the existing `OPEN_STATUSES` rule - no new query, same
 * list-row pattern already used for Warranty Claims/PM History/Quality
 * Cases (no new list widget invented).
 */
export default function MachineRelatedRecordsPanel({ records }: { records: MachineRelatedRecord[] }) {
  const open = records.filter((r) => r.bucket === 'open');
  const history = records.filter((r) => r.bucket === 'history');

  return (
    <Card variant="compact" className="p-6" as="section" id="related-records">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.relatedRecordsTitle')}</h2>
      {records.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{t('machinePassport.noRelatedRecords')}</p>
      ) : (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('machinePassport.relatedRecordsOpen')}
          </h3>
          <RecordList records={open} emptyLabel={t('machinePassport.noOpenRelatedRecords')} />

          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('machinePassport.relatedRecordsHistory')}
          </h3>
          <RecordList records={history} emptyLabel={t('machinePassport.noRelatedRecordsHistory')} />
        </>
      )}
    </Card>
  );
}

function RecordList({ records, emptyLabel }: { records: MachineRelatedRecord[]; emptyLabel: string }) {
  if (records.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-400">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {records.map((record) => (
        <li key={`${record.module}-${record.recordId}`}>
          <Link href={record.href} className="block rounded border border-gray-100 p-3 text-sm hover:bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-brand-dark">
                <span className="mr-2 rounded-full bg-brand-dark/5 px-2 py-0.5 text-xs font-medium text-brand-dark">
                  {t(MODULE_LABEL_KEY[record.module])}
                </span>
                {record.reference}
              </span>
              {record.status && <span className="text-xs text-gray-500">{record.status}</span>}
            </div>
            {record.date && <p className="mt-1 text-xs text-gray-500">{record.date}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

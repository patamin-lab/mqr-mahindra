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
 * Machine Digital Passport v1.1 refinement - Related Records panel. One
 * flat, cross-module list of every MQR/PM/NTR record already known to
 * belong to this machine (same records Warranty/PM/Quality/Activity read
 * independently) - each row links straight to that record's own detail
 * page, same list-row pattern already used for Warranty Claims/PM
 * History/Quality Cases (no new list widget invented).
 */
export default function MachineRelatedRecordsPanel({ records }: { records: MachineRelatedRecord[] }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="related-records">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.relatedRecordsTitle')}</h2>
      {records.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{t('machinePassport.noRelatedRecords')}</p>
      ) : (
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
      )}
    </Card>
  );
}

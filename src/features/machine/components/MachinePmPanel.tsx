import Card from '@/components/shared/layout/Card';
import DetailRow from '@/components/shared/layout/DetailRow';
import StatusPill from '@/components/shared/status/StatusPill';
import { t } from '@/lib/i18n/server';
import { MachineSummary } from '../types';
import type { MaintenanceRecord } from '@/features/maintenance/types';

const DUE_COLOR_CLASS: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-500',
};

/**
 * Machine Digital Passport - Preventive Maintenance section. Completed
 * count and History both come from `fetchMaintenanceHistoryForSerial()`
 * (existing, scoped) - the same read `MachineService.getMachineAttachments()`
 * already uses for PM's own attachments. Upcoming/Overdue reuse
 * `MachineSummary`'s existing `maintenanceDueColor`/`nextMaintenanceLabel`
 * (the same fields Machine 360's Maintenance section already shows) rather
 * than a second due-date calculation.
 */
export default function MachinePmPanel({ summary, pmRecords }: { summary: MachineSummary; pmRecords: MaintenanceRecord[] }) {
  const overdue = summary.maintenanceDueColor === 'red';

  return (
    <Card variant="compact" className="p-6" as="section" id="pm">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.pmTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailRow label={t('machinePassport.pmCompleted')} value={String(pmRecords.length)} />
        <DetailRow label={t('machinePassport.pmUpcoming')} value={summary.nextMaintenanceLabel ?? 'N/A'} />
        <div className="rounded border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">{t('machinePassport.pmOverdue')}</p>
          <p className="mt-1">
            <StatusPill className="rounded-full px-2 py-0.5 text-xs font-medium" colorClassName={DUE_COLOR_CLASS[summary.maintenanceDueColor]}>
              {overdue ? t('machinePassport.pmOverdue') : summary.maintenanceDueLabel}
            </StatusPill>
          </p>
        </div>
        <DetailRow
          label={t('common.compliance')}
          value={summary.compliancePercent != null ? `${summary.completedStageCount} / ${summary.expectedStageCount} (${summary.compliancePercent}%)` : 'N/A'}
        />
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('machinePassport.pmHistoryTitle')}</h3>
      {pmRecords.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{t('machinePassport.noPmHistory')}</p>
      ) : (
        <ul className="space-y-2">
          {pmRecords.map((record) => (
            <li key={record.id} className="rounded border border-gray-100 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-brand-dark">{record.pm_number ?? record.id}</span>
                <span className="text-xs text-gray-500">{record.performed_date ?? 'N/A'}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {record.hour_meter != null ? `${record.hour_meter} ${t('unit.hours')}` : 'N/A'} · {record.technician_name ?? 'N/A'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

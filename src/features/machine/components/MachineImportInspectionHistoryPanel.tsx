import Link from 'next/link';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';
import type { Inspection } from '@/features/inspection';

/**
 * Machine Digital Passport - Import Inspection history (ADR-017,
 * business-domain correction: "Machine Passport must display the complete
 * Import Inspection history"). Every inspection event for this machine,
 * oldest first (PDI #1 -> RE-PDI #2 -> RE-PDI #3 -> ...), immutable -
 * never overwritten. Reuses `InspectionService` directly (via
 * `MachineService.getMachineImportInspectionHistory()`); this is not a
 * second timeline - the milestone view still comes from the shared
 * Activity Timeline (`MachineLifecyclePanel`) via the `PDI_COMPLETED`/
 * `RELEASED_TO_DEALER` platform events. `canViewFull` gates only the
 * click-through to the full MSEAL-only detail screen - the summary row
 * itself (count/date/technician/result/release status) is dealer-visible.
 */
export default function MachineImportInspectionHistoryPanel({ inspections, canViewFull }: { inspections: Inspection[]; canViewFull: boolean }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="import-inspection">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.importInspectionTitle')}</h2>
      {inspections.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={t('machinePassport.importInspectionNoRecord')}
          reason={t('machinePassport.importInspectionNoRecord')}
          nextStep={t('machinePassport.importInspectionNoRecordNextStep')}
        />
      ) : (
        <ul className="space-y-2">
          {inspections.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 p-3 text-sm">
              <div>
                <span className="font-medium text-brand-dark">
                  {i.inspectionType === 'RE_PDI' ? `${t('pdi.type.RE_PDI')} #${i.inspectionSequence}` : t('pdi.type.PDI')}
                </span>{' '}
                <span className="text-xs text-gray-500">
                  {i.inspectionRef} · {i.technicianName} · {i.result ? t(`pdi.result.${i.result}`) : t(`pdi.status.${i.status}`)} ·{' '}
                  {i.findings.length} {t('machinePassport.importInspectionFindingsCount')} · {t(`pdi.releaseStatus.${i.releaseStatus}`)}
                </span>
              </div>
              {canViewFull && (
                <Link href={`/delivery/pdi/${i.id}`} className="text-xs font-medium text-brand-primary hover:underline">
                  {t('machinePassport.deliveryViewFull')} →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

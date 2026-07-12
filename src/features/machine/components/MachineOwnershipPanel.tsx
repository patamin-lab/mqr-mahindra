import Card from '@/components/shared/layout/Card';
import DetailRow from '@/components/shared/layout/DetailRow';
import { t } from '@/lib/i18n/server';
import { MachineSummary } from '../types';

/**
 * Machine Digital Passport - Ownership section. Current Owner/Dealer/
 * Branch all map to existing `MachineSummary` fields (owner name/phone are
 * derived read-time from the latest MQR/PM/NTR record - see
 * `docs/architecture/MACHINE_DATA_OWNERSHIP.md`). Owner History and Region
 * have no table/column anywhere in the schema today - shown honestly
 * rather than fabricated, same as Identity's Manufacturing Year/Country.
 */
export default function MachineOwnershipPanel({ summary }: { summary: MachineSummary }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="ownership">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.ownershipTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailRow label={t('common.owner')} value={summary.ownerName ?? 'N/A'} />
        <DetailRow label={t('pdf.customerPhone')} value={summary.ownerPhone ?? 'N/A'} />
        <DetailRow label={t('common.dealer')} value={summary.dealerName ?? summary.dealerId ?? 'N/A'} />
        <DetailRow label={t('common.branch')} value={summary.branchName ?? 'N/A'} />
        <DetailRow label={t('machinePassport.region')} value={t('machinePassport.notAvailable')} />
        <DetailRow label={t('machinePassport.ownerHistory')} value={t('machinePassport.notAvailable')} />
      </div>
      <p className="mt-3 text-xs text-gray-400">{t('machinePassport.noOwnerHistory')}</p>
    </Card>
  );
}

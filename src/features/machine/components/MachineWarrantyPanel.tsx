import Card from '@/components/shared/layout/Card';
import DetailRow from '@/components/shared/layout/DetailRow';
import { t } from '@/lib/i18n/server';
import { MachineWarrantySummary } from '../types';

/**
 * Machine Digital Passport - Warranty section, backed by
 * `MachineService.getMachineWarrantySummary()` (existing `calcWarranty()` +
 * MQR's own `warranty_status` snapshots - no new calculation, no new
 * table). "Remaining" is derived from age vs. limit rather than stored.
 */
export default function MachineWarrantyPanel({ warranty }: { warranty: MachineWarrantySummary }) {
  const remainingMonths = warranty.limitMonths != null && warranty.ageMonths != null ? Math.max(0, warranty.limitMonths - warranty.ageMonths) : null;

  return (
    <Card variant="compact" className="p-6" as="section" id="warranty">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.warrantyTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailRow label={t('machinePassport.warrantyOverallStatus')} value={warranty.status ?? 'N/A'} />
        <DetailRow label={t('machinePassport.warrantyAge')} value={warranty.ageMonths != null ? `${warranty.ageMonths} ${t('unit.months')}` : 'N/A'} />
        <DetailRow label={t('common.warranty')} value={remainingMonths != null ? `${remainingMonths} ${t('unit.months')}` : 'N/A'} />
        <DetailRow label={t('machinePassport.warrantyLimit')} value={warranty.limitMonths != null ? `${warranty.limitMonths} ${t('unit.months')}` : 'N/A'} />
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('machinePassport.warrantyClaimsTitle')}</h3>
      {warranty.claims.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{t('machinePassport.noWarrantyClaims')}</p>
      ) : (
        <ul className="space-y-2">
          {warranty.claims.map((claim) => (
            <li key={claim.jobId} className="rounded border border-gray-100 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-brand-dark">{claim.jobId}</span>
                <span className="text-xs text-gray-500">{claim.warrantyStatus}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {claim.problemSystem ?? 'N/A'} · {claim.foundDate ?? 'N/A'} · {claim.recordStatus}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

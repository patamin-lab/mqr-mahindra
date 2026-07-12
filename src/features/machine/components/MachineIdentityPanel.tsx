import Card from '@/components/shared/layout/Card';
import DetailRow from '@/components/shared/layout/DetailRow';
import { t } from '@/lib/i18n/server';
import { MachineSummary } from '../types';

/**
 * Machine Digital Passport - Identity section. Every field maps to an
 * existing `MachineSummary`/`vehicles` row column - no new query. Variant,
 * Manufacturing Year and Manufacturing Country have no column anywhere in
 * the schema today (confirmed against `lib/types.ts`'s `Vehicle` and
 * `VehicleSummary`) - shown honestly as "not tracked yet" rather than
 * invented, per `docs/architecture/MACHINE_DATA_OWNERSHIP.md`. `variant` is
 * the closest existing analog (`vehicles.sub_model`), passed in by the
 * caller since it isn't part of `MachineSummary` itself.
 */
export default function MachineIdentityPanel({ summary, subModel }: { summary: MachineSummary; subModel: string | null }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="identity">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.identityTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailRow label={t('common.serial')} value={summary.serial} />
        <DetailRow label={t('common.engineNumber')} value={summary.engineNumber ?? 'N/A'} />
        <DetailRow label={t('common.model')} value={summary.model ?? 'N/A'} />
        <DetailRow label={t('machinePassport.variant')} value={subModel ?? t('machinePassport.notTrackedYet')} />
        <DetailRow label={t('common.productFamily')} value={summary.productFamilyName ?? 'N/A'} />
        <DetailRow label={t('machinePassport.manufacturingYear')} value={t('machinePassport.notTrackedYet')} />
        <DetailRow label={t('machinePassport.manufacturingCountry')} value={t('machinePassport.notTrackedYet')} />
      </div>
    </Card>
  );
}

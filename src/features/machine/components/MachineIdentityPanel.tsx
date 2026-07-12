import Card from '@/components/shared/layout/Card';
import DetailRow from '@/components/shared/layout/DetailRow';
import { t } from '@/lib/i18n/server';
import { MachineSummary } from '../types';

/**
 * Machine Digital Passport - Identity section. Every field maps to an
 * existing `MachineSummary`/`vehicles` row column - no new query.
 * Manufacturing Country has no column anywhere in the schema today
 * (confirmed against `lib/types.ts`'s `Vehicle` and `VehicleSummary`) -
 * shown honestly as "not tracked yet" rather than invented. Variant and
 * Manufacturing Year are a different, more subtle case: `NtrRecord` does
 * carry `variant`/`manufacturing_year` columns, but only Legacy-Import-era
 * registrations have them populated (the current manual NTR form doesn't
 * collect either) - too sparse/registration-date-dependent to promote to
 * Identity yet, so this panel still shows `vehicles.sub_model` for Variant
 * and "not tracked yet" for Manufacturing Year. See "Documentation
 * correction" in `docs/architecture/MACHINE_DATA_OWNERSHIP.md` for the full
 * Current/Future Source of Truth discussion - this is a deliberate choice,
 * not an oversight.
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

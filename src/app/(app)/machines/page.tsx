import VehicleSearchBox from '@/features/vehicle/vehicle-search-box';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';

/**
 * Vehicle 360 (Machine Digital Passport) landing/search page - the sole
 * vehicle-lookup destination (ADR-030); `/vehicles` now redirects here
 * rather than rendering a second, near-duplicate search page.
 */
export default function MachinesIndexPage() {
  return (
    <div className="space-y-4">
      <PageHeader title={t('machinePassport.title')} subtitle={t('vehicle360.tractorRegistrySubtitle')} className="block" />
      <VehicleSearchBox />
    </div>
  );
}

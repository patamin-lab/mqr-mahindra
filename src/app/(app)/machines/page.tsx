import VehicleSearchBox from '@/features/vehicle/vehicle-search-box';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';

/**
 * Machine Digital Passport v1.0 - landing/search page. Reuses the exact
 * same serial-search box and `/api/vehicles/search` endpoint Vehicle 360's
 * `/vehicles` index page already uses (`VehicleSearchBox`'s `basePath`
 * prop), pointed at `/machines/[machineId]` instead of `/vehicles/[serial]`
 * - no second search implementation.
 */
export default function MachinesIndexPage() {
  return (
    <div className="space-y-4">
      <PageHeader title={t('machinePassport.title')} subtitle={t('vehicle360.tractorRegistrySubtitle')} className="block" />
      <VehicleSearchBox basePath="/machines" />
    </div>
  );
}

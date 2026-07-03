import VehicleSearchBox from '@/features/vehicle/vehicle-search-box';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';

export default function VehiclesIndexPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title={t('nav.vehicle360')}
        subtitle={t('vehicle360.tractorRegistrySubtitle')}
        className="block"
      />
      <VehicleSearchBox />
    </div>
  );
}

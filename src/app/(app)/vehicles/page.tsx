import VehicleSearchBox from '@/features/vehicle/vehicle-search-box';
import { t } from '@/lib/i18n/server';

export default function VehiclesIndexPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-dark">{t('nav.vehicle360')}</h1>
        <p className="text-sm text-gray-500">{t('vehicle360.tractorRegistrySubtitle')}</p>
      </div>
      <VehicleSearchBox />
    </div>
  );
}

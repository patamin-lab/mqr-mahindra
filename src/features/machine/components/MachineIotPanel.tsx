import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';

/**
 * Machine Digital Passport - Future IoT section. No telemetry
 * integration/table exists anywhere in this codebase today - every tile is
 * a reserved placeholder (MSEAL Design Framework, ADR-023 Coming Soon
 * tone), not a fake reading.
 */
const ITEMS: { icon: string; titleKey: string }[] = [
  { icon: '⏱️', titleKey: 'machinePassport.iotRunningHours' },
  { icon: '⛽', titleKey: 'machinePassport.iotFuel' },
  { icon: '📍', titleKey: 'machinePassport.iotGps' },
  { icon: '❤️', titleKey: 'machinePassport.iotEngineHealth' },
];

export default function MachineIotPanel() {
  return (
    <Card variant="compact" className="p-6" as="section" id="iot">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.iotTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item) => (
          <EmptyState
            key={item.titleKey}
            icon={item.icon}
            title={t(item.titleKey)}
            reason={t('machinePassport.iotReason')}
            nextStep={t('machinePassport.iotNextStep')}
            comingSoon
          />
        ))}
      </div>
    </Card>
  );
}

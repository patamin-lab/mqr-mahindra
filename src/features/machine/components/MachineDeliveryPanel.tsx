import Link from 'next/link';
import Card from '@/components/shared/layout/Card';
import DetailRow from '@/components/shared/layout/DetailRow';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';
import { MachineDeliverySummary } from '@/features/delivery';

/**
 * Machine Digital Passport - Delivery section (ADR-017/ADR-027), backed by
 * `MachineService.getMachineDeliverySummary()` -> `DeliveryService`. Read
 * only; Machine owns no Delivery data of its own.
 */
export default function MachineDeliveryPanel({ delivery }: { delivery: MachineDeliverySummary | null }) {
  if (!delivery) {
    return (
      <Card variant="compact" className="p-6" as="section" id="delivery">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.deliveryTitle')}</h2>
        <EmptyState
          icon="🚚"
          title={t('machinePassport.deliveryNoRecord')}
          reason={t('machinePassport.deliveryNoRecord')}
          nextStep={t('machinePassport.deliveryNoRecordNextStep')}
        />
      </Card>
    );
  }

  return (
    <Card variant="compact" className="p-6" as="section" id="delivery">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.deliveryTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailRow label={t('machinePassport.deliveryStage')} value={delivery.stage} />
        <DetailRow label={t('machinePassport.deliveryOverallStatus')} value={delivery.overallStatus} />
        <DetailRow label={t('machinePassport.deliveryPdiResult')} value={delivery.pdiResult ?? 'N/A'} />
        <DetailRow label={t('machinePassport.deliveryTrainingCompleted')} value={delivery.trainingCompleted ? '✓' : '—'} />
        <DetailRow label={t('machinePassport.deliveryWarrantyActivated')} value={delivery.warrantyActivatedAt ?? '—'} />
      </div>
      <Link href={delivery.href} className="mt-4 inline-block text-sm font-medium text-brand-primary hover:underline">
        {t('machinePassport.deliveryViewFull')} ({delivery.deliveryRef}) →
      </Link>
    </Card>
  );
}

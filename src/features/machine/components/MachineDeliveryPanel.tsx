import Link from 'next/link';
import Card from '@/components/shared/layout/Card';
import DetailRow from '@/components/shared/layout/DetailRow';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';
import { MachineDeliverySummary } from '@/features/delivery';
import StartDeliveryTrackingButton from '@/features/delivery/components/StartDeliveryTrackingButton';

/**
 * Machine Digital Passport - Delivery section (ADR-017/ADR-027), backed by
 * `MachineService.getMachineDeliverySummary()` -> `DeliveryService`. Read
 * only; Machine owns no Delivery data of its own. Links to the full
 * Delivery Record detail (`/delivery/records/[id]`) once one exists -
 * Platform Stabilization (ADR-031) removed that link when the General
 * Delivery lifecycle-tracking UI it pointed to was itself dead/unreachable
 * code; now that the UI is resurfaced (Production Pilot's "Delivery
 * Records/Detail/Stage Tracking" scope) and reachable from navigation,
 * the link is restored.
 */
export default function MachineDeliveryPanel({
  delivery,
  serial,
  warrantyStartDate,
}: {
  delivery: MachineDeliverySummary | null;
  serial: string;
  warrantyStartDate: string | null;
}) {
  if (!delivery) {
    return (
      <Card variant="compact" className="p-6" as="section" id="delivery">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.deliveryTitle')}</h2>
        <EmptyState
          icon="🚚"
          title={t('machinePassport.deliveryNoRecord')}
          reason={t('machinePassport.deliveryNoRecord')}
          nextStep={t('machinePassport.deliveryNoRecordNextStep')}
          action={<StartDeliveryTrackingButton serial={serial} />}
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
        <DetailRow label={t('machinePassport.deliveryWarrantyStartDate')} value={warrantyStartDate ?? '—'} />
      </div>
      <p className="mt-4 text-xs text-gray-400">
        <Link href={`/delivery/records/${delivery.id}`} className="text-brand-red hover:underline">
          {delivery.deliveryRef} · {t('machinePassport.viewFullDeliveryRecord')}
        </Link>
      </p>
    </Card>
  );
}

import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { listAuditLog } from '@/lib/db';
import { DeliveryService } from '@/features/delivery';
import { InspectionService } from '@/features/inspection';
import { createNtrService } from '@/features/ntr/factory';
import { t } from '@/lib/i18n/server';
import { mapAuditLogToActivityEvents } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';
import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import DeliveryStageTracker from '@/features/delivery/components/DeliveryStageTracker';
import DeliveryActionsPanel from '@/features/delivery/components/DeliveryActionsPanel';
import DeliveryFutureAiPanel from '@/features/delivery/components/DeliveryFutureAiPanel';

const service = new DeliveryService();
const inspectionService = new InspectionService();
const ntrService = createNtrService();

/**
 * Delivery Record detail (ADR-027). Screen Contract (docs/architecture/
 * DELIVERY_PLATFORM.md §6): Purpose - track/advance one machine's
 * delivery lifecycle. Primary User - Dealer User (advance stages),
 * Dealer Admin (Delivery Acceptance, manual Warranty Activation).
 * Primary Decision - "what's the next action to move this delivery
 * forward." Timeline - `<ActivityTimeline>`, fed by `record_audit_log`
 * (module `'delivery'`), zero component changes. Linked records (PDI
 * Inspection, NTR) are read-only summaries here - this screen never
 * duplicates their own fields.
 */
export default async function DeliveryDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return null;

  let delivery;
  try {
    delivery = await service.getDelivery(params.id);
  } catch {
    return (
      <div className="space-y-4">
        <PageHeader title={t('delivery.notFoundTitle')} />
        <EmptyState icon="🔎" title={t('delivery.notFoundTitle')} reason={t('delivery.notFoundReason')} nextStep={t('delivery.notFoundNextStep')} />
        <Link href="/delivery/records" className="text-sm text-brand-red hover:underline">
          ← {t('common.backToList')}
        </Link>
      </div>
    );
  }

  const [auditLog, availableInspectionsRaw, linkedInspection, linkedNtr] = await Promise.all([
    listAuditLog('delivery', delivery.id),
    inspectionService.listInspectionsForSerial(delivery.serial),
    delivery.pdiInspectionId ? inspectionService.getInspection(delivery.pdiInspectionId).catch(() => null) : Promise.resolve(null),
    delivery.ntrId ? ntrService.getById(delivery.ntrId, session).catch(() => null) : Promise.resolve(null),
  ]);
  const availableInspections = availableInspectionsRaw.map((i) => ({ id: i.id, inspectionRef: i.inspectionRef, status: i.status }));
  const activityEvents = mapAuditLogToActivityEvents(auditLog, {
    entityType: 'delivery',
    entityId: delivery.id,
    entityRef: delivery.deliveryRef,
    vehicleSerial: delivery.serial,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={delivery.deliveryRef}
        subtitle={`${delivery.serial} · ${delivery.overallStatus}`}
        titleClassName="text-xl font-bold text-brand-dark"
        backLink={
          <Link href="/delivery/records" className="text-sm text-gray-500 hover:underline">
            ← {t('common.backToList')}
          </Link>
        }
      />

      <Card variant="flat" className="p-5">
        <DeliveryStageTracker stage={delivery.stage} />
      </Card>

      {linkedInspection && (
        <Card variant="flat" className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-brand-dark">{t('pdi.title')}</h2>
          <Link href={`/delivery/pdi/${linkedInspection.id}`} className="text-sm text-brand-red hover:underline">
            {linkedInspection.inspectionRef} · {t(`pdi.status.${linkedInspection.status}`)}
            {linkedInspection.result ? ` · ${t(`pdi.result.${linkedInspection.result}`)}` : ''} →
          </Link>
        </Card>
      )}

      {linkedNtr && (
        <Card variant="flat" className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-brand-dark">{t('delivery.stage.CustomerDelivery')}</h2>
          <Link href={`/ntr/${linkedNtr.id}`} className="text-sm text-brand-red hover:underline">
            {linkedNtr.ntr_number} · {linkedNtr.customer_name} →
          </Link>
        </Card>
      )}

      <DeliveryActionsPanel deliveryId={delivery.id} stage={delivery.stage} role={session.role} availableInspections={availableInspections} />

      {delivery.warrantyActivatedAt && (
        <Card variant="flat" className="p-5 text-sm text-gray-600">
          <span className="font-medium text-brand-dark">{t('delivery.warrantyActivatedLabel')}:</span> {delivery.warrantyActivatedAt} (
          {delivery.warrantyActivationSource})
        </Card>
      )}

      <Card as="section" variant="flat" className="p-5">
        <ActivityTimeline events={activityEvents} entityLabel={t('delivery.title')} />
      </Card>

      <DeliveryFutureAiPanel />
    </div>
  );
}

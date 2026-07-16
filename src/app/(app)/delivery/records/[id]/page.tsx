import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { seesAllDealers, canApproveDelivery } from '@/lib/scope';
import { listAuditLog } from '@/lib/db';
import { DeliveryService, DELIVERY_STAGE_ORDER } from '@/features/delivery';
import { InspectionService } from '@/features/inspection';
import { fetchNtrRecordsForSerial } from '@/features/ntr/utils/fetchNtrRecordsForSerial';
import { t } from '@/lib/i18n/server';
import { mapAuditLogToActivityEvents } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';
import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import DeliveryRecordActions from '@/features/delivery/components/DeliveryRecordActions';

const service = new DeliveryService();
const inspectionService = new InspectionService();

/**
 * Delivery Record detail (ADR-027, resurfaced per Production Pilot's
 * "Delivery Records/Detail/Stage Tracking" scope - Dashboard/Reports/AI
 * explicitly out of scope). Every read here goes through an already-
 * existing service (`DeliveryService`, `InspectionService`,
 * `fetchNtrRecordsForSerial`) - no direct Supabase query, no new
 * aggregation. Timeline reuses the shared `<ActivityTimeline>` fed by
 * `record_audit_log` (module `'delivery'`), the exact same wiring
 * `delivery/pdi/[id]/page.tsx` already uses for module `'pdi'`.
 */
export default async function DeliveryRecordDetailPage({ params }: { params: { id: string } }) {
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

  if (!seesAllDealers(session.role) && session.dealerId !== delivery.dealerId) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('delivery.recordsTitle')} />
        <EmptyState icon="🔒" title={t('delivery.forbiddenTitle')} reason={t('delivery.forbiddenReason')} nextStep={t('delivery.forbiddenNextStep')} />
      </div>
    );
  }

  const [auditLog, inspectionsForSerial, ntrRecordsForSerial, training] = await Promise.all([
    listAuditLog('delivery', delivery.id),
    inspectionService.listInspectionsForSerial(delivery.serial),
    fetchNtrRecordsForSerial(delivery.serial, session),
    delivery.trainingId ? service.getTraining(delivery.trainingId) : Promise.resolve(null),
  ]);

  const linkedInspection = delivery.pdiInspectionId ? inspectionsForSerial.find((i) => i.id === delivery.pdiInspectionId) ?? null : null;
  const linkedNtr = delivery.ntrId ? ntrRecordsForSerial.find((n) => n.id === delivery.ntrId) ?? null : null;

  const activityEvents = mapAuditLogToActivityEvents(auditLog, {
    entityType: 'delivery',
    entityId: delivery.id,
    entityRef: delivery.deliveryRef,
    vehicleSerial: delivery.serial,
  });

  const currentStageIndex = DELIVERY_STAGE_ORDER.indexOf(delivery.stage);

  return (
    <div className="space-y-4">
      <PageHeader
        title={delivery.deliveryRef}
        subtitle={`${delivery.serial} · ${t(`delivery.stage.${delivery.stage}`)}`}
        titleClassName="text-xl font-bold text-brand-dark"
        backLink={
          <Link href="/delivery/records" className="text-sm text-gray-500 hover:underline">
            ← {t('common.backToList')}
          </Link>
        }
      />

      <Card variant="flat" className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('delivery.stageTrackerTitle')}</h2>
        <ol className="flex flex-wrap gap-2 text-xs">
          {DELIVERY_STAGE_ORDER.map((s, i) => (
            <li
              key={s}
              className={`rounded-full px-3 py-1 ${
                i < currentStageIndex
                  ? 'bg-green-100 text-green-700'
                  : i === currentStageIndex
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {t(`delivery.stage.${s}`)}
            </li>
          ))}
        </ol>
      </Card>

      <Card variant="flat" className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500">{t('common.dealer')}</p>
          <p className="text-sm font-medium text-brand-dark">{delivery.dealerId ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('delivery.overallStatusLabel')}</p>
          <p className="text-sm font-medium text-brand-dark">{t(`delivery.overallStatus.${delivery.overallStatus}`)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('delivery.stockYardLocationLabel')}</p>
          <p className="text-sm font-medium text-brand-dark">{delivery.stockYardLocation ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('machinePassport.deliveryWarrantyActivated')}</p>
          <p className="text-sm font-medium text-brand-dark">{delivery.warrantyActivatedAt ?? '-'}</p>
        </div>
      </Card>

      <Card variant="flat" className="p-5" as="section">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('delivery.nextActionTitle')}</h2>
        <DeliveryRecordActions
          deliveryId={delivery.id}
          stage={delivery.stage}
          canApprove={canApproveDelivery(session.role)}
          availableInspections={inspectionsForSerial.map((i) => ({ id: i.id, inspectionRef: i.inspectionRef, status: i.status }))}
          availableNtrRecords={ntrRecordsForSerial.map((n) => ({ id: n.id, ntrNumber: n.ntr_number }))}
        />
      </Card>

      <Card variant="flat" className="p-5" as="section">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('pdi.title')}</h2>
        {linkedInspection ? (
          <Link href={`/delivery/pdi/${linkedInspection.id}`} className="text-sm text-brand-red hover:underline">
            {linkedInspection.inspectionRef} · {t(`pdi.status.${linkedInspection.status}`)}
          </Link>
        ) : (
          <p className="text-sm text-gray-400">{t('delivery.noInspectionLinkedYet')}</p>
        )}
      </Card>

      <Card variant="flat" className="p-5" as="section">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('nav.ntrRecords')}</h2>
        {linkedNtr ? (
          <Link href={`/ntr/${encodeURIComponent(linkedNtr.id)}`} className="text-sm text-brand-red hover:underline">
            {linkedNtr.ntr_number} · {linkedNtr.customer_name}
          </Link>
        ) : (
          <p className="text-sm text-gray-400">{t('delivery.noNtrLinkedYet')}</p>
        )}
      </Card>

      <Card variant="flat" className="p-5" as="section">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('delivery.trainingTitle')}</h2>
        {training ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">{t('delivery.operatorNameLabel')}</p>
              <p className="font-medium text-brand-dark">{training.operatorName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('delivery.trainerNameLabel')}</p>
              <p className="font-medium text-brand-dark">{training.trainerName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('delivery.trainingDateLabel')}</p>
              <p className="font-medium text-brand-dark">{training.trainingDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('delivery.notesLabel')}</p>
              <p className="font-medium text-brand-dark">{training.notes ?? '-'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t('delivery.noTrainingRecordedYet')}</p>
        )}
      </Card>

      <Card as="section" variant="flat" className="p-5">
        <ActivityTimeline events={activityEvents} entityLabel={t('delivery.recordsTitle')} />
      </Card>
    </div>
  );
}

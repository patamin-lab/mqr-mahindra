import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { listAuditLog, getVehicleBySerial } from '@/lib/db';
import { UNRESTRICTED_SCOPE } from '@/lib/dealerBranchScope';
import { InspectionService } from '@/features/inspection';
import { canAccessImportInspection } from '@/lib/scope';
import { AttachmentService } from '@/shared/attachments';
import { t } from '@/lib/i18n/server';
import { mapAuditLogToActivityEvents } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';
import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import AttachmentViewer from '@/components/shared/attachments/AttachmentViewer';
import ChecklistEditor from '@/features/inspection/components/ChecklistEditor';
import FindingsSection from '@/features/inspection/components/FindingsSection';
import MeasurementsSection from '@/features/inspection/components/MeasurementsSection';
import PartsReplacedSection from '@/features/inspection/components/PartsReplacedSection';
import InspectionActions from '@/features/inspection/components/InspectionActions';
import FactoryFeedbackPanel from '@/features/inspection/components/FactoryFeedbackPanel';

const service = new InspectionService();
const attachmentService = new AttachmentService();

/**
 * Import Inspection detail (ADR-017, business-domain correction). Screen
 * Contract (docs/architecture/INSPECTION_PDI.md §6): Purpose - perform/
 * review one Import Inspection event (checklist, findings, evidence,
 * measurements, parts replacement, sign-off, Release to Dealer). Primary
 * User - MSEAL technician/inspector. Permissions - belongs exclusively to
 * MSEAL (`canAccessImportInspection`) - Dealer roles get an empty state,
 * never the record. Timeline - `<ActivityTimeline>`, fed by
 * `record_audit_log` (module `'pdi'`), zero component changes. Evidence -
 * `AttachmentService` (module `'pdi'`, entityType `'Inspection'`).
 */
export default async function InspectionDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessImportInspection(session.role)) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('pdi.title')} />
        <EmptyState icon="🔒" title={t('pdi.forbiddenTitle')} reason={t('pdi.forbiddenReason')} nextStep={t('pdi.forbiddenNextStep')} />
      </div>
    );
  }

  let inspection;
  try {
    inspection = await service.getInspection(params.id, session);
  } catch {
    return (
      <div className="space-y-4">
        <PageHeader title={t('pdi.notFoundTitle')} />
        <EmptyState icon="🔎" title={t('pdi.notFoundTitle')} reason={t('pdi.notFoundReason')} nextStep={t('pdi.notFoundNextStep')} />
        <Link href="/delivery/pdi" className="text-sm text-brand-red hover:underline">
          ← {t('common.backToList')}
        </Link>
      </div>
    );
  }

  // Production Stability: `service.getInspection()` above is the only call
  // wrapped in try/catch (a missing/invalid inspection is the expected,
  // common failure) - these three reads are a genuinely new attack surface
  // for the same crash class Bug 5 fixed on Machine Passport (an orphaned
  // attachment row, a transient DB error, or a legacy inspection with no
  // `serial` - `getVehicleBySerial` would throw on `serial.trim()`). None
  // of the three are essential to render the page (audit log/evidence/
  // vehicle header all already degrade to an empty list or `-` elsewhere
  // in this file), so a failure here must fail open, not crash the route.
  const [auditLog, evidence, vehicle] = await Promise.all([
    listAuditLog('pdi', inspection.id).catch((err) => {
      console.error('PDI detail: listAuditLog failed', err);
      return [];
    }),
    attachmentService.list('pdi', 'Inspection', inspection.id).catch((err) => {
      console.error('PDI detail: attachmentService.list failed', err);
      return [];
    }),
    inspection.serial
      ? getVehicleBySerial(inspection.serial, UNRESTRICTED_SCOPE).catch((err) => {
          console.error('PDI detail: getVehicleBySerial failed', err);
          return null;
        })
      : Promise.resolve(null),
  ]);
  const evidenceWithUrls = await Promise.all(
    evidence.map(async (d) => ({ ...d, url: (await attachmentService.getUrl(d.id).catch(() => null))?.url ?? null }))
  );
  const activityEvents = mapAuditLogToActivityEvents(auditLog, {
    entityType: 'pdi',
    entityId: inspection.id,
    entityRef: inspection.inspectionRef,
    vehicleSerial: inspection.serial,
  });

  const canEdit = inspection.status !== 'Completed' && inspection.status !== 'Cancelled';

  return (
    <div className="space-y-4">
      <PageHeader
        title={inspection.inspectionRef}
        subtitle={`${inspection.serial} · ${t(`pdi.status.${inspection.status}`)}${inspection.result ? ` · ${t(`pdi.result.${inspection.result}`)}` : ''}`}
        titleClassName="text-xl font-bold text-brand-dark"
        backLink={
          <Link href="/delivery/pdi" className="text-sm text-gray-500 hover:underline">
            ← {t('common.backToList')}
          </Link>
        }
        actions={
          <InspectionActions
            inspectionId={inspection.id}
            status={inspection.status}
            result={inspection.result}
            signedOffAt={inspection.signedOffAt}
            releaseStatus={inspection.releaseStatus}
            technicianName={inspection.technicianName}
          />
        }
      />

      <Card variant="flat" className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500">{t('common.engineNumber')}</p>
          <p className="text-sm font-medium text-brand-dark">{vehicle?.engine_number ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('csv.productCode')}</p>
          <p className="text-sm font-medium text-brand-dark">{vehicle?.product_code ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('csv.model')}</p>
          <p className="text-sm font-medium text-brand-dark">
            {vehicle?.model ?? '-'}
            <Link href={`/machines/${encodeURIComponent(inspection.serial)}`} className="ml-2 text-xs text-brand-red hover:underline">
              {t('pmDetail.viewVehicle360')}
            </Link>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('common.dealer')}</p>
          <p className="text-sm font-medium text-brand-dark">{vehicle?.dealer_id ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('csv.whArrivalDate')}</p>
          <p className="text-sm font-medium text-brand-dark">{vehicle?.wh_arrival_date ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('csv.deliveryDate')}</p>
          <p className="text-sm font-medium text-brand-dark">{vehicle?.delivery_date ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('pdi.checklistVersionLabel')}</p>
          <p className="text-sm font-medium text-brand-dark">{inspection.checklistVersion}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('pdi.technicianLabel')}</p>
          <p className="text-sm font-medium text-brand-dark">{inspection.technicianName}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('pdi.signedOffLabel')}</p>
          <p className="text-sm font-medium text-brand-dark">{inspection.signedOffBy ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('pdi.inspectionReasonLabel')}</p>
          <p className="text-sm font-medium text-brand-dark">{t(`pdi.reason.${inspection.inspectionReason}`)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('pdi.releaseStatusLabel')}</p>
          <p className="text-sm font-medium text-brand-dark">{t(`pdi.releaseStatus.${inspection.releaseStatus}`)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('pdi.nextRePdiDueDateLabel')}</p>
          <p className="text-sm font-medium text-brand-dark">{inspection.nextRePdiDueDate ?? '-'}</p>
        </div>
        {inspection.previousInspectionId && (
          <div>
            <p className="text-xs text-gray-500">{t('pdi.previousInspectionLabel')}</p>
            <Link href={`/delivery/pdi/${inspection.previousInspectionId}`} className="text-sm font-medium text-brand-red hover:underline">
              {t('pdi.viewPreviousInspection')} →
            </Link>
          </div>
        )}
      </Card>

      <ChecklistEditor inspectionId={inspection.id} checklist={inspection.checklist} canEdit={canEdit} />
      <FindingsSection inspectionId={inspection.id} findings={inspection.findings} canEdit={canEdit} />
      <MeasurementsSection inspectionId={inspection.id} measurements={inspection.measurements} canEdit={canEdit} />
      <PartsReplacedSection inspectionId={inspection.id} partsReplaced={inspection.partsReplaced} canEdit={canEdit} />
      <FactoryFeedbackPanel inspectionId={inspection.id} factoryFeedback={inspection.factoryFeedback} />

      <Card variant="flat" className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('knowledge.relatedDocumentsTitle')}</h2>
        <AttachmentViewer items={evidenceWithUrls} emptyMessage={t('knowledge.noRelatedRecords')} />
      </Card>

      <Card as="section" variant="flat" className="p-5">
        <ActivityTimeline events={activityEvents} entityLabel={t('pdi.title')} />
      </Card>
    </div>
  );
}

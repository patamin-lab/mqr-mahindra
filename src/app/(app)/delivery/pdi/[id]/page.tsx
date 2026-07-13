import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { listAuditLog } from '@/lib/db';
import { InspectionService } from '@/features/inspection';
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

const service = new InspectionService();
const attachmentService = new AttachmentService();

/**
 * PDI Inspection detail (ADR-017). Screen Contract (docs/architecture/
 * INSPECTION_PDI.md §6): Purpose - perform/review one PDI (checklist,
 * findings, evidence, measurements, parts replacement, sign-off, dealer
 * approval). Primary User - Technician, Dealer Admin (approval).
 * Permissions - every role may edit while not Completed; Dealer Approval
 * gated server-side by `canApproveDelivery`. Timeline -
 * `<ActivityTimeline>`, fed by `record_audit_log` (module `'pdi'`), zero
 * component changes. Evidence - `AttachmentService` (module `'pdi'`,
 * entityType `'Inspection'`), the pre-seeded retention policy this
 * platform already reserved for PDI.
 */
export default async function InspectionDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return null;

  let inspection;
  try {
    inspection = await service.getInspection(params.id);
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

  const [auditLog, evidence] = await Promise.all([
    listAuditLog('pdi', inspection.id),
    attachmentService.list('pdi', 'Inspection', inspection.id),
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
            signedOffAt={inspection.signedOffAt}
            dealerApprovedAt={inspection.dealerApprovedAt}
            role={session.role}
          />
        }
      />

      <Card variant="flat" className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="text-xs text-gray-500">{t('pdi.dealerApprovedLabel')}</p>
          <p className="text-sm font-medium text-brand-dark">{inspection.dealerApprovedBy ?? '-'}</p>
        </div>
      </Card>

      <ChecklistEditor inspectionId={inspection.id} checklist={inspection.checklist} canEdit={canEdit} />
      <FindingsSection inspectionId={inspection.id} findings={inspection.findings} canEdit={canEdit} />
      <MeasurementsSection inspectionId={inspection.id} measurements={inspection.measurements} canEdit={canEdit} />
      <PartsReplacedSection inspectionId={inspection.id} partsReplaced={inspection.partsReplaced} canEdit={canEdit} />

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

import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { listAuditLog } from '@/lib/db';
import { KnowledgeService } from '@/features/knowledge';
import { canReviewKnowledge } from '@/lib/scope';
import { AttachmentService } from '@/shared/attachments';
import { MasterDataService } from '@/shared/master-data';
import { t } from '@/lib/i18n/server';
import { mapAuditLogToActivityEvents } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';
import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import AttachmentViewer from '@/components/shared/attachments/AttachmentViewer';
import MaturityPill from '@/features/knowledge/components/MaturityPill';
import ConfidencePill from '@/features/knowledge/components/ConfidencePill';
import KnowledgeMaturityControl from '@/features/knowledge/components/KnowledgeMaturityControl';
import KnowledgeCaseFieldsForm from '@/features/knowledge/components/KnowledgeCaseFieldsForm';
import KnowledgeEvidenceSection from '@/features/knowledge/components/KnowledgeEvidenceSection';
import KnowledgeFutureAiPanel from '@/features/knowledge/components/KnowledgeFutureAiPanel';

const service = new KnowledgeService();
const attachmentService = new AttachmentService();

/**
 * Knowledge Case detail (ADR-018). Screen Contract (docs/architecture/
 * KNOWLEDGE_PLATFORM.md §6): Purpose — review/edit one Knowledge
 * Candidate/Case and drive it through Engineering Review. Primary User —
 * Technician/Engineer. Primary Decision — "is this ready to publish."
 * Primary Action — add Evidence, or transition Maturity. Permissions —
 * every role may view/edit while Draft/Review; `canReviewKnowledge`
 * (`lib/scope.ts`) gates Published+/maturity transitions, enforced
 * server-side by the API routes, not here. Timeline —
 * `<ActivityTimeline>`, fed by `record_audit_log` (module `'knowledge'`),
 * zero component changes. Related Records — Machines/Quality Reports/PM/
 * Warranty (derived from Evidence, see `KnowledgeService.getCase()`) +
 * Documents (case-level attachments). Future AI Panel — reserved, see
 * `KnowledgeFutureAiPanel`.
 */
export default async function KnowledgeCaseDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return null;

  let detail;
  try {
    detail = await service.getCase(params.id);
  } catch {
    return (
      <div className="space-y-4">
        <PageHeader title={t('knowledge.caseNotFoundTitle')} />
        <EmptyState icon="🔎" title={t('knowledge.caseNotFoundTitle')} reason={t('knowledge.caseNotFoundReason')} nextStep={t('knowledge.caseNotFoundNextStep')} />
        <Link href="/quality/knowledge" className="text-sm text-brand-red hover:underline">
          ← {t('common.backToList')}
        </Link>
      </div>
    );
  }

  const { case: kase, evidence, relatedMachines, relatedQualityReports, relatedPm, relatedWarranty } = detail;

  const [auditLog, documents, productFamily] = await Promise.all([
    listAuditLog('knowledge', kase.id),
    attachmentService.list('knowledge', 'knowledge_case', kase.id),
    kase.productFamilyId ? MasterDataService.getProductFamilyById(kase.productFamilyId) : Promise.resolve(null),
  ]);
  const documentsWithUrls = await Promise.all(
    documents.map(async (d) => ({ ...d, url: (await attachmentService.getUrl(d.id).catch(() => null))?.url ?? null }))
  );
  const activityEvents = mapAuditLogToActivityEvents(auditLog, {
    entityType: 'knowledge',
    entityId: kase.id,
    entityRef: kase.caseRef,
    vehicleSerial: relatedMachines[0] ?? null,
  });

  const canEditFields = kase.maturity !== 'Published' || canReviewKnowledge(session.role);

  return (
    <div className="space-y-4">
      <PageHeader
        title={kase.caseRef}
        subtitle={kase.symptom}
        titleClassName="text-xl font-bold text-brand-dark"
        backLink={
          <Link href="/quality/knowledge" className="text-sm text-gray-500 hover:underline">
            ← {t('common.backToList')}
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <ConfidencePill confidence={kase.confidence} label={t(`knowledge.confidence.${kase.confidence}`)} />
            <KnowledgeMaturityControl caseId={kase.id} maturity={kase.maturity} role={session.role} />
          </div>
        }
      />

      <KnowledgeCaseFieldsForm kase={kase} canEdit={canEditFields} />

      {productFamily && (
        <Card variant="flat" className="p-5 text-sm text-gray-600">
          <span className="font-medium text-brand-dark">{t('knowledge.productFamilyLabel')}:</span> {productFamily.name}
          {kase.model && <span> · {t('knowledge.modelLabel')}: {kase.model}</span>}
        </Card>
      )}

      <KnowledgeEvidenceSection caseId={kase.id} evidence={evidence} />

      <Card variant="flat" className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('knowledge.relatedDocumentsTitle')}</h2>
        <AttachmentViewer items={documentsWithUrls} emptyMessage={t('knowledge.noRelatedRecords')} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card variant="flat" className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-brand-dark">{t('knowledge.relatedMachinesTitle')}</h2>
          {relatedMachines.length === 0 ? (
            <p className="text-xs text-gray-400">{t('knowledge.noRelatedRecords')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {relatedMachines.map((serial) => (
                <li key={serial}>
                  <Link href={`/machines/${encodeURIComponent(serial)}`} className="text-brand-red hover:underline">
                    {serial}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card variant="flat" className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-brand-dark">{t('knowledge.relatedQualityReportsTitle')}</h2>
          {relatedQualityReports.length === 0 ? (
            <p className="text-xs text-gray-400">{t('knowledge.noRelatedRecords')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {relatedQualityReports.map((r) => (
                <li key={r.recordId}>
                  <Link href={r.href} className="text-brand-red hover:underline">
                    {r.recordId}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card variant="flat" className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-brand-dark">{t('knowledge.relatedPmTitle')}</h2>
          {relatedPm.length === 0 ? (
            <p className="text-xs text-gray-400">{t('knowledge.noRelatedRecords')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {relatedPm.map((r) => (
                <li key={r.recordId}>
                  <Link href={r.href} className="text-brand-red hover:underline">
                    {r.recordId}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {relatedWarranty.length > 0 && (
        <Card variant="flat" className="p-5">
          <h2 className="mb-2 text-sm font-semibold text-brand-dark">{t('knowledge.relatedWarrantyTitle')}</h2>
          <ul className="space-y-1 text-sm">
            {relatedWarranty.map((r) => (
              <li key={r.recordId}>
                <Link href={r.href} className="text-brand-red hover:underline">
                  {r.recordId}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card as="section" variant="flat" className="p-5">
        <ActivityTimeline events={activityEvents} entityLabel={t('knowledge.title')} />
      </Card>

      <KnowledgeFutureAiPanel />
    </div>
  );
}

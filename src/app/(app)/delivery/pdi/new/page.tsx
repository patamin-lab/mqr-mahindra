import { getSession } from '@/lib/auth';
import { canAccessImportInspection } from '@/lib/scope';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import EmptyState from '@/components/shared/layout/EmptyState';
import NewInspectionForm from './NewInspectionForm';

/** Create a PDI Inspection - resolves `serial` to a vehicle server-side
 *  (`POST /api/inspections`), same as every other module's create form.
 *  MSEAL-only (`canAccessImportInspection`), same server-side gate as its
 *  three sibling PDI pages (list/dashboard/detail) - previously missing
 *  here, so a Dealer role navigating directly to this URL saw the create
 *  form (the underlying API/service already rejected the submission via
 *  `InspectionService`'s own `assertMsealAccess`, so this was a UX/direct-
 *  URL gap, not a real write-path vulnerability). */
export default async function NewInspectionPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessImportInspection(session.role)) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('pdi.createTitle')} />
        <EmptyState icon="🔒" title={t('pdi.forbiddenTitle')} reason={t('pdi.forbiddenReason')} nextStep={t('pdi.forbiddenNextStep')} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('pdi.createTitle')} subtitle={t('pdi.createSubtitle')} titleClassName="text-xl font-bold text-brand-dark" />
      <NewInspectionForm defaultTechnicianName={session.fullName ?? session.username} />
    </div>
  );
}

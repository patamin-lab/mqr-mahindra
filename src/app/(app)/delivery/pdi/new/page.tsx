import { getSession } from '@/lib/auth';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import NewInspectionForm from './NewInspectionForm';

/** Create a PDI Inspection - resolves `serial` to a vehicle server-side
 *  (`POST /api/inspections`), same as every other module's create form. */
export default async function NewInspectionPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="space-y-4">
      <PageHeader title={t('pdi.createTitle')} subtitle={t('pdi.createSubtitle')} titleClassName="text-xl font-bold text-brand-dark" />
      <NewInspectionForm defaultTechnicianName={session.fullName ?? session.username} />
    </div>
  );
}

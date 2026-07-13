import { getSession } from '@/lib/auth';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import NewDeliveryForm from './NewDeliveryForm';

/** Tractor In (stage 1) - resolves `serial` to a vehicle already
 *  registered via the existing Tractor In Sync (ADR-012), server-side
 *  (`POST /api/delivery-records`). */
export default async function NewDeliveryPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="space-y-4">
      <PageHeader title={t('delivery.createTitle')} subtitle={t('delivery.createSubtitle')} titleClassName="text-xl font-bold text-brand-dark" />
      <NewDeliveryForm />
    </div>
  );
}

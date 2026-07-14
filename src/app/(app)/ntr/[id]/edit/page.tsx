import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { createNtrService } from '@/features/ntr/factory';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import NtrEditForm from './NtrEditForm';

interface RouteParams {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

/** NTR Edit - same PUT /api/ntr-records/[id] the record already exposed;
 *  this screen was the missing UI for it. Authorization mirrors the route
 *  itself (dealer/branch scope only, no extra role gate - the route never
 *  had one beyond scope, see `api/ntr-records/[id]/route.ts`'s `PUT`).
 *  Vehicle master fields (serial/model/engine number/product family) are
 *  never editable here - they come only from `vehicles`, never duplicated/
 *  overwritten by this form. */
export default async function NtrEditPage({ params }: RouteParams) {
  const session = await getSession();
  if (!session) return null;

  const record = await createNtrService().getById(params.id, session);

  if (!record) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('ntr.editTitle')} />
        <div className="rounded border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p>{t('ntr.notFound')}</p>
        </div>
      </div>
    );
  }

  if (!canAccessDealerBranch(session, record.dealer_id, record.branch_id)) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('ntr.editTitle')} />
        <div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">
          <p>{t('validation.unauthorizedRecordAccess')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('ntr.editTitle')}
        subtitle={record.ntr_number}
        actions={
          <Link href={`/ntr/${encodeURIComponent(record.id)}`} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            {t('common.cancel')}
          </Link>
        }
      />
      <NtrEditForm record={record} />
    </div>
  );
}

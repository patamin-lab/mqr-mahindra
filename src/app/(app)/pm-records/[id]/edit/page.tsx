import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { fetchMaintenance } from '@/features/maintenance/utils/fetchMaintenance';
import { evaluateMaintenanceLock } from '@/features/maintenance/utils/maintenanceLock';
import MaintenanceForm from '@/features/maintenance/components/maintenance-form';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function PmRecordEditPage({ params }: RouteParams) {
  const session = await getSession();
  if (!session) return null;

  const result = await fetchMaintenance(params.id);

  if ('notFound' in result && result.notFound) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('pmEdit.title')}
          subtitle={t('pmDetail.recordIdLabel', { id: params.id })}
          actions={
            <Link href="/pm-records" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
              {t('common.backToList')}
            </Link>
          }
        />

        <div className="rounded border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p>{t('pmDetail.notFound')}</p>
        </div>
      </div>
    );
  }

  if ('error' in result) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('pmEdit.title')}
          subtitle={t('pmDetail.recordIdLabel', { id: params.id })}
          actions={
            <Link href="/pm-records" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
              {t('common.backToList')}
            </Link>
          }
        />

        <div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">
          <p>{t('pmDetail.errorPrefix', { error: result.error })}</p>
        </div>
      </div>
    );
  }

  if (!('record' in result)) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('pmEdit.title')}
          subtitle={t('pmDetail.recordIdLabel', { id: params.id })}
          actions={
            <Link href="/pm-records" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
              {t('common.backToList')}
            </Link>
          }
        />

        <div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">
          <p>{t('pmDetail.unexpectedError')}</p>
        </div>
      </div>
    );
  }

  const record = result.record;
  const lock = evaluateMaintenanceLock(record);

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title={t('pmEdit.title')}
        subtitle={t('pmDetail.recordIdLabel', { id: record.id })}
        actions={
          <Link
            href={`/pm-records/${encodeURIComponent(record.id)}`}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            {t('pmEdit.backToDetail')}
          </Link>
        }
      />

      {lock.locked && (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          🔒 {t('pmDetail.lockedBannerPrefix', { reason: t(`lockReason.${lock.reason}`) })}
          {t('pmEdit.lockedBannerSuffix')}
        </div>
      )}

      <MaintenanceForm
        mode="edit"
        recordId={record.id}
        showDealerField={seesAllDealers(session.role)}
        locked={lock.locked}
        initial={{
          dealer_id: record.dealer_id,
          branch_id: record.branch_id,
          serial: record.serial,
          technician_id: record.technician_id,
          scheduled_date: record.scheduled_date,
          performed_date: record.performed_date,
          status: record.status,
          notes: record.notes,
        }}
      />
    </div>
  );
}

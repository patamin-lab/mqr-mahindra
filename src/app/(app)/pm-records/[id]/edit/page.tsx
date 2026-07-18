import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { evaluateMaintenanceLock } from '@/features/maintenance/utils/maintenanceLock';
import MaintenanceForm from '@/features/maintenance/components/maintenance-form';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import EmptyState from '@/components/shared/layout/EmptyState';

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function PmRecordEditPage({ params }: RouteParams) {
  const session = await getSession();
  if (!session) return null;

  // Direct repository/service call - see pm-records/[id]/page.tsx's own
  // comment for why (this used to self-fetch `/api/pm-records/[id]` over
  // HTTP, the confirmed root cause of PM's View/Edit-doesn't-open bug).
  let record;
  try {
    const repository = new SupabaseMaintenanceRepository();
    record = await new MaintenanceService(repository).getById(params.id, session);
  } catch (error) {
    console.error('PM record edit load error', error);
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

        <EmptyState icon="⚠️" title={t('pmEdit.title')} reason={t('pmDetail.errorPrefix', { error: t('pmDetail.unexpectedError') })} nextStep={t('pmDetail.errorNextStep')} />
      </div>
    );
  }

  if (!record) {
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

        <EmptyState icon="🔍" title={t('pmDetail.notFound')} reason={t('pmDetail.notFoundReason')} nextStep={t('pmDetail.notFoundNextStep')} />
      </div>
    );
  }

  if (!canAccessDealerBranch(session, record.dealer_id, record.branch_id)) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('pmEdit.title')} />
        <EmptyState icon="🔒" title={t('pmDetail.unauthorizedTitle')} reason={t('validation.unauthorizedRecordAccess')} nextStep={t('pmDetail.unauthorizedNextStep')} />
      </div>
    );
  }

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
          model: record.model,
          technician_id: record.technician_id,
          scheduled_date: record.scheduled_date,
          performed_date: record.performed_date,
          status: record.status,
          notes: record.notes,
          customer_name: record.customer_name,
          customer_phone: record.customer_phone,
          hour_meter: record.hour_meter,
          pm_interval_id: record.pm_interval_id,
          meter_photo_url: record.meter_photo_url,
          nameplate_photo_url: record.nameplate_photo_url,
          report_photo_url: record.report_photo_url,
          meter_photo_attachment_id: record.meter_photo_attachment_id,
          nameplate_photo_attachment_id: record.nameplate_photo_attachment_id,
          report_photo_attachment_id: record.report_photo_attachment_id,
          latitude: record.latitude,
          longitude: record.longitude,
          gps_accuracy: record.gps_accuracy,
          google_maps_url: record.google_maps_url,
        }}
      />
    </div>
  );
}

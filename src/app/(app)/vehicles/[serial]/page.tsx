import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { MachineService } from '@/features/machine';
import MachineTimelineRow from '@/features/machine/components/MachineTimelineRow';
import type { MaintenanceDueColor } from '@/features/maintenance-due/types';
import type { HealthStatus } from '@/features/vehicle-health/types';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import StatusPill from '@/components/shared/status/StatusPill';
import Card from '@/components/shared/layout/Card';
import Timeline from '@/components/shared/timeline/Timeline';
import DetailRow from '@/components/shared/layout/DetailRow';
import AttachmentViewer from '@/components/shared/attachments/AttachmentViewer';
import { AttachmentService } from '@/shared/attachments';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { serial: string };
}

const DUE_COLOR_CLASS: Record<MaintenanceDueColor, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-500',
};

const HEALTH_STATUS_CLASS: Record<HealthStatus, string> = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  attention: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const machineService = new MachineService();
const attachmentService = new AttachmentService();

export default async function Machine360Page({ params }: RouteParams) {
  const serial = decodeURIComponent(params.serial);
  const session = await getSession();
  if (!session) return null;

  const [summary, timeline, attachments] = await Promise.all([
    machineService.getMachine360(serial, session),
    machineService.getMachineTimeline(serial, session),
    machineService.getMachineAttachments(serial, session),
  ]);
  // Machine 360 reads only through AttachmentService (ADR-010) - never a
  // storage provider or module table directly. Resolved here (server-side,
  // at request time) rather than persisted, since a Supabase signed URL
  // expires.
  const attachmentItems = await Promise.all(
    attachments.map(async (a) => {
      const resolved = await attachmentService.getUrl(a.id).catch(() => null);
      return { id: a.id, filename: a.filename, mimeType: a.mimeType, url: resolved?.url ?? null };
    })
  );

  if (!summary) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('vehicle360.tractorProfileTitle')}
          subtitle={`${t('common.serial')}: ${serial}`}
          actions={
            <Link href="/vehicles" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('vehicle360.searchAgain')}
            </Link>
          }
        />
        <div className="rounded border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p>{t('vehicle360.notFound')}</p>
        </div>
      </div>
    );
  }

  const programLabel =
    summary.maintenanceProgramStages.length > 0
      ? summary.maintenanceProgramStages
          .map((s) => s.label)
          .join(' / ')
      : t('vehicle360.noMaintenanceProgramSet');

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('vehicle360.tractorProfileTitle')}
        subtitle={`${summary.serial} ${summary.model ? `· ${summary.model}` : ''}`}
        actions={
          <Link href="/vehicles" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            {t('vehicle360.searchAgain')}
          </Link>
        }
      />

      <Card variant="compact" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('vehicle360.vehicleOwnerInfo')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow label={t('common.serial')} value={summary.serial} />
          <DetailRow label={t('common.model')} value={summary.model ?? 'N/A'} />
          <DetailRow label={t('common.productFamily')} value={summary.productFamilyName ?? t('vehicle360.notLinkedToProductFamily')} />
          <DetailRow label={t('common.engineNumber')} value={summary.engineNumber ?? 'N/A'} />
          <DetailRow label={t('pdf.deliveryDate')} value={summary.retailDate ?? 'N/A'} />
          <DetailRow label={t('common.dealer')} value={summary.dealerName ?? summary.dealerId ?? 'N/A'} />
          <DetailRow label={t('common.branch')} value={summary.branchName ?? 'N/A'} />
          <DetailRow label={t('common.owner')} value={summary.ownerName ?? 'N/A'} />
          <DetailRow label={t('pdf.customerPhone')} value={summary.ownerPhone ?? 'N/A'} />
          <DetailRow label={t('csv.currentLifecycle')} value={t(`lifecycleStatus.${summary.lifecycleStatus}`)} />
        </div>
      </Card>

      <Card variant="compact" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('vehicle360.maintenanceSectionTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow
            label={t('common.maintenanceProgram')}
            value={
              summary.maintenanceProgramVersionNumber != null
                ? `${programLabel} (${t('vehicle360.versionLabel', { version: String(summary.maintenanceProgramVersionNumber) })})`
                : programLabel
            }
          />
          <DetailRow
            label={t('vehicle360.currentHourMeter')}
            value={summary.currentHourMeter != null ? `${summary.currentHourMeter} ${t('unit.hours')}` : 'N/A'}
          />
          <DetailRow label={t('vehicle360.lastMaintenanceDate')} value={summary.lastMaintenanceDate ?? t('vehicle360.noMaintenanceHistory')} />
          <DetailRow label={t('pdf.nextPmDue')} value={summary.nextMaintenanceLabel ?? 'N/A'} />
          <DetailRow
            label={t('vehicle360.remainingHours')}
            value={summary.remainingHours != null ? `${summary.remainingHours} ${t('unit.hours')}` : 'N/A'}
          />
          <DetailRow
            label={t('vehicle360.remainingDays')}
            value={summary.remainingDays != null ? `${summary.remainingDays} ${t('unit.days')}` : 'N/A'}
          />
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('vehicle360.maintenanceStatus')}</p>
            <p className="mt-1">
              <StatusPill className="rounded-full px-2 py-0.5 text-xs font-medium" colorClassName={DUE_COLOR_CLASS[summary.maintenanceDueColor]}>
                {summary.maintenanceDueLabel}
              </StatusPill>
            </p>
          </div>
          <DetailRow
            label={t('common.compliance')}
            value={
              summary.compliancePercent != null
                ? `${summary.completedStageCount} / ${summary.expectedStageCount} (${summary.compliancePercent}%)`
                : 'N/A'
            }
          />
        </div>
      </Card>

      <Card variant="compact" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('vehicle360.tractorHealthTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('common.healthScore')}</p>
            <p className="mt-1 text-2xl font-bold text-brand-dark">{summary.healthScore}</p>
          </div>
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('vehicle360.healthStatusLabel')}</p>
            <p className="mt-1">
              <StatusPill className="rounded-full px-2 py-0.5 text-xs font-medium" colorClassName={HEALTH_STATUS_CLASS[summary.healthStatus]}>
                {t(`health.${summary.healthStatus}`)}
              </StatusPill>
            </p>
          </div>
          <DetailRow label={t('vehicle360.openMqrLabel')} value={String(summary.openMqrCount)} />
          <DetailRow label={t('vehicle360.pendingCampaignLabel')} value={String(summary.pendingCampaignCount)} />
        </div>
      </Card>

      <Card variant="compact" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('vehicle360.tractorLifeCycleTitle')}</h2>
        {timeline.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">{t('vehicle360.noTimelineEvents')}</p>
        ) : (
          <Timeline className="space-y-3">
            {timeline.map((event, idx) => (
              <MachineTimelineRow key={`${event.type}-${event.referenceNumber}-${idx}`} event={event} />
            ))}
          </Timeline>
        )}
      </Card>

      <Card variant="compact" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machine360.attachmentsTitle')}</h2>
        <AttachmentViewer items={attachmentItems} emptyMessage={t('attachmentViewer.noAttachments')} />
      </Card>

      {/* Machine Digital Passport v1.0 - the new permanent home for this
       *  machine (Identity/Ownership/Warranty/PM/Quality/Documents/IoT,
       *  plus the field-level Activity Timeline this page doesn't show).
       *  This page (Machine 360) is unchanged otherwise - not replaced,
       *  not redirected - just cross-linked for discoverability. Keyed by
       *  serial, same as this page, not the `vehicles.id` UUID - a search
       *  result can reference a Tractor-IN-sheet row that hasn't synced
       *  into `vehicles` (no `id`) yet, but always has a serial. */}
      <div className="text-center">
        <Link href={`/machines/${encodeURIComponent(serial)}`} className="text-sm text-brand-red hover:underline">
          {t('machine360.viewPassportLink')}
        </Link>
      </div>
    </div>
  );
}

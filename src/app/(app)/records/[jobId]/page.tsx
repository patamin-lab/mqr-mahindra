import Link from 'next/link';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getRecordByJobId, getVehicleHistory, listAuditLog } from '@/lib/db';
import { MasterDataService } from '@/shared/master-data';
import { canUpdateStatus, canExport, canDelete } from '@/lib/scope';
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_I18N_KEY, STATUS_LABELS } from '@/lib/types';
import { formatDateTimeLocalized } from '@/lib/thaiDate';
import UpdateForm from './update-form';
import DeleteButton from './delete-button';
import PrintButton from './print-button';
import RecordPrintView from './print-view';
import { t, getServerLocale } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import StatusPill from '@/components/shared/status/StatusPill';
import Card from '@/components/shared/layout/Card';
import MqrImageGallery from '@/features/mqr/components/MqrImageGallery';
import { mqrPhotoToImageItem } from '@/lib/mqrImageItems';
import { AttachmentService } from '@/shared/attachments';
import { mapAuditLogToActivityEvents } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';
import RecordActivityTimelineSection from './activity-timeline-section';

/** MQR's own closing-status vocabulary, passed to the generic activity
 *  adapter so it can render ✅ Closed / ↩ Reopened without itself knowing
 *  what "Repaired"/"Closed" mean - see `mapAuditLogToActivityEvents.ts`.
 *  `updateRecord()` writes `record_audit_log.old_value`/`new_value` for a
 *  `StatusChanged` row as `STATUS_LABELS[status]` (the Thai display text),
 *  never the raw `StatusValue` code - so the comparison values here must
 *  be the same labels, not `['Repaired', 'Closed']`, or this never matches. */
const MQR_CLOSING_STATUSES = [STATUS_LABELS.Repaired, STATUS_LABELS.Closed];

const attachmentService = new AttachmentService();

export default async function RecordDetailPage({ params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) return null;
  const locale = getServerLocale();

  const jobId = decodeURIComponent(params.jobId);
  const record = await getRecordByJobId(jobId, session);
  if (!record) notFound();

  // A photo/video uploaded via the Attachment Platform stores only
  // `attachmentId` durably - its `url` may be a Supabase signed URL that
  // has since expired, so it's never trusted directly. Resolve a fresh
  // one here, server-side, at request time - a pre-migration entry with
  // no `attachmentId` keeps using its stored Drive URL unchanged. See
  // docs/engineering/ATTACHMENT_FRAMEWORK.md.
  record.photo_links = await Promise.all(
    (record.photo_links ?? []).map(async (p) => {
      if (!p.attachmentId) return p;
      const resolved = await attachmentService.getUrl(p.attachmentId).catch(() => null);
      return resolved ? { ...p, url: resolved.url } : p;
    })
  );
  if (record.video_attachment_id) {
    const resolved = await attachmentService.getUrl(record.video_attachment_id).catch(() => null);
    if (resolved) record.video_link = resolved.url;
  }

  const dealer = await MasterDataService.getDealerById(record.dealer_id);
  const history = record.serial ? await getVehicleHistory(record.serial, session) : [];
  const auditLog = await listAuditLog('mqr', record.id);
  const activityEvents = mapAuditLogToActivityEvents(auditLog, {
    entityType: 'mqr',
    entityId: record.id,
    entityRef: record.job_id,
    vehicleSerial: record.serial,
    closingStatusValues: MQR_CLOSING_STATUSES,
  });
  const otherHistory = history.filter((h) => h.job_id !== record.job_id);
  const encodedJobId = encodeURIComponent(record.job_id);
  const allowExport = canExport(session.role);
  const allowDelete = canDelete(session.role);
  // Same permission that already gates the Update Status section below -
  // "existing edit permission" for this record.
  const allowEdit = canUpdateStatus(session.role);

  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host');
  const baseUrl = `${proto}://${host}`;
  const recordUrl = `${baseUrl}/records/${encodeURIComponent(record.job_id)}`;
  const qrDataUrl = await QRCode.toDataURL(recordUrl, { margin: 0, width: 160 });

  return (
    <div className="max-w-4xl">
      <RecordPrintView record={record} dealerName={dealer?.full_name} qrDataUrl={qrDataUrl} recordUrl={recordUrl} />
      <div className="print:hidden space-y-6">
      <PageHeader
        title={record.job_id}
        titleClassName="text-2xl font-bold text-brand-dark"
        className="flex items-start justify-between gap-3 flex-wrap"
        backLink={
          <Link href="/records" className="text-sm text-gray-500 hover:underline print:hidden">
            ← {t('common.backToList')}
          </Link>
        }
        titleAdornments={
          <>
            <StatusPill colorClassName="bg-gray-100 text-gray-700">
              {t(`mqrStatus.${record.status}`)}
            </StatusPill>
            {record.severity && (
              <StatusPill
                colorClassName={
                  record.severity === 'Critical'
                    ? 'bg-red-100 text-red-700'
                    : record.severity === 'Major'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }
              >
                {t(`severity.${record.severity}`)}
              </StatusPill>
            )}
          </>
        }
        subtitle={dealer?.full_name ?? record.dealer_id}
        actionsClassName="flex items-center gap-2 print:hidden"
        actions={
          <>
            <PrintButton />
            {allowEdit && (
              <Link
                href={`/records/${encodedJobId}/edit`}
                className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                {t('recordDetail.editReport')}
              </Link>
            )}
            {allowExport && (
              <>
                <a
                  href={`/api/records/${encodedJobId}/export?format=xlsx`}
                  className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  {t('common.exportExcel')}
                </a>
                <a
                  href={`/api/records/${encodedJobId}/export?format=pdf`}
                  className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  {t('common.exportPdf')}
                </a>
              </>
            )}
            {allowDelete && <DeleteButton jobId={record.job_id} />}
          </>
        }
      />

      <Card as="section" variant="flat" className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-400 text-xs">{t('pdf.colVehicle')}</div>
          <div>
            {record.model ?? '-'} ({record.serial ?? '-'})
            {record.serial && (
              <Link
                href={`/machines/${encodeURIComponent(record.serial)}`}
                className="ml-2 text-xs text-brand-red hover:underline print:hidden"
              >
                {t('pmDetail.viewVehicle360')}
              </Link>
            )}
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">{t('csv.hours')}</div>
          <div>{record.hours ?? '-'}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">{t('pdf.foundDate')}</div>
          <div>{record.found_date ?? '-'}</div>
        </div>
        <div id="warranty-section">
          <div className="text-gray-400 text-xs">{t('pdf.warrantyStatus')}</div>
          <div>{record.warranty_status ?? '-'}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">{t('pdf.problemFound')}</div>
          <div>{record.problem_code ?? '-'}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">{t('pdf.system')}</div>
          <div>{record.problem_system === 'powertrain' ? t('pdf.powertrainSystem') : t('pdf.otherSystem')}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">{t('pdf.customerName')}</div>
          <div>{record.customer_name ?? '-'} {record.customer_phone ? `(${record.customer_phone})` : ''}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">{t('pdf.reporterName')}</div>
          <div>{record.reporter_name ?? '-'} {record.reporter_phone ? `(${record.reporter_phone})` : ''}</div>
        </div>
        {record.peripheral_equipment && (
          <div>
            <div className="text-gray-400 text-xs">{t('pdf.peripheralEquipment')}</div>
            <div>{record.peripheral_equipment}</div>
          </div>
        )}
        <div className="sm:col-span-2">
          <div className="text-gray-400 text-xs">{t('pdf.problemDetailSectionTitle')}</div>
          <div className="whitespace-pre-wrap">{record.attachment ?? '-'}</div>
        </div>
        {record.stock_note && (
          <div className="sm:col-span-2">
            <div className="text-gray-400 text-xs">{t('pdf.stockNote')}</div>
            <div>{record.stock_note}</div>
          </div>
        )}
        {record.lat !== null && record.lng !== null && (
          <div className="sm:col-span-2">
            <div className="text-gray-400 text-xs">{t('pdf.gpsLocation')}</div>
            <a
              className="text-brand-red hover:underline"
              target="_blank"
              href={record.google_maps_url ?? `https://maps.google.com/?q=${record.lat},${record.lng}`}
            >
              {record.lat}, {record.lng}
            </a>
            {record.gps_accuracy !== null && (
              <span className="ml-2 text-xs text-gray-400">
                {t('pdf.gpsAccuracySuffix', { m: String(Math.round(record.gps_accuracy)) })}
              </span>
            )}
          </div>
        )}
      </Card>

      {(record.cause || record.damaged_parts || record.technician_action || record.corrective_action || record.preventive_action) && (
        <Card id="rca-section" as="section" variant="flat" className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <h2 className="font-semibold text-brand-dark sm:col-span-2">{t('pdf.rcaSectionTitle')}</h2>
          {record.cause && (
            <div>
              <div className="text-gray-400 text-xs">{t('pdf.cause')}</div>
              <div className="whitespace-pre-wrap">{record.cause}</div>
            </div>
          )}
          {record.damaged_parts && (
            <div>
              <div className="text-gray-400 text-xs">{t('pdf.damagedParts')}</div>
              <div className="whitespace-pre-wrap">{record.damaged_parts}</div>
            </div>
          )}
          {record.technician_action && (
            <div>
              <div className="text-gray-400 text-xs">{t('pdf.technicianAction')}</div>
              <div className="whitespace-pre-wrap">{record.technician_action}</div>
            </div>
          )}
          {record.corrective_action && (
            <div>
              <div className="text-gray-400 text-xs">{t('pdf.correctiveAction')}</div>
              <div className="whitespace-pre-wrap">{record.corrective_action}</div>
            </div>
          )}
          {record.preventive_action && (
            <div className="sm:col-span-2">
              <div className="text-gray-400 text-xs">{t('pdf.preventiveAction')}</div>
              <div className="whitespace-pre-wrap">{record.preventive_action}</div>
            </div>
          )}
        </Card>
      )}

      {(record.photo_links?.length || record.video_link) && (
        <Card id="photos-section" as="section" variant="flat" className="p-5 space-y-4">
          <h2 className="font-semibold text-brand-dark">{t('recordDetail.photosVideosTitle')}</h2>
          {PHOTO_CATEGORIES.map((cat) => {
            const photos = (record.photo_links ?? []).filter((p) => p.category === cat.key);
            if (photos.length === 0) return null;
            const categoryLabel = t(`pdf.${PHOTO_CATEGORY_I18N_KEY[cat.key]}`);
            return (
              <div key={cat.key}>
                <div className="text-xs text-gray-400 mb-2">{categoryLabel}</div>
                <MqrImageGallery
                  items={photos.map((p, i) => mqrPhotoToImageItem(p, `${record.job_id}-${cat.key}-${i}`, categoryLabel))}
                  labels={{
                    zoomOut: t('attachmentViewer.zoomOut'),
                    zoomIn: t('attachmentViewer.zoomIn'),
                    rotate: t('attachmentViewer.rotateRight'),
                    reset: t('attachmentViewer.reset'),
                    toolbar: t('attachmentViewer.imageControls'),
                  }}
                  navigationLabels={{
                    previous: t('attachmentViewer.previous'),
                    next: t('attachmentViewer.next'),
                    close: t('attachmentViewer.close'),
                  }}
                />
              </div>
            );
          })}
          {record.video_link && (
            <div className="print:hidden">
              <div className="text-xs text-gray-400 mb-2">{t('pdf.videoLabel')}</div>
              <iframe
                src={record.video_link.replace('/view', '/preview')}
                className="w-full aspect-video rounded border border-gray-200"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
              <a
                href={record.video_link}
                target="_blank"
                className="inline-block text-xs text-brand-red hover:underline mt-1"
              >
                {t('recordDetail.openVideoNewTab')}
              </a>
            </div>
          )}
        </Card>
      )}

      {otherHistory.length > 0 && (
        <Card as="section" variant="flat" className="p-5 print:hidden">
          <h2 className="font-semibold text-brand-dark mb-3">
            {t('recordDetail.vehicleRepairHistory', { count: String(otherHistory.length) })}
          </h2>
          <ul className="text-sm divide-y divide-gray-100">
            {otherHistory.map((h) => (
              <li key={h.id} className="py-2 flex justify-between gap-3">
                <Link href={`/records/${encodeURIComponent(h.job_id)}`} className="text-brand-red hover:underline font-mono">
                  {h.job_id}
                </Link>
                <span className="text-gray-500">{h.found_date}</span>
                <span className="text-gray-700 flex-1">{h.problem_code}</span>
                <span className="text-gray-500">{t(`mqrStatus.${h.status}`)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card id="status-section" as="section" variant="flat" className="p-5 print:hidden">
        <h2 className="font-semibold text-brand-dark mb-3">{t('recordDetail.updateStatusTitle')}</h2>
        {canUpdateStatus(session.role) ? (
          <UpdateForm record={record} role={session.role} />
        ) : (
          <p className="text-sm text-gray-500">{t('recordDetail.noPermissionUpdateStatus')}</p>
        )}
      </Card>

      <Card as="section" variant="flat" className="p-5 print:hidden">
        <RecordActivityTimelineSection events={activityEvents} />
      </Card>

      <Card as="section" variant="flat" className="p-5 text-xs text-gray-500 space-y-1">
        <h2 className="font-semibold text-brand-dark text-sm mb-2">{t('recordDetail.recordMetadataTitle')}</h2>
        <div>{t('pdf.createdByAt', { by: record.created_by ?? record.user_name ?? '-', at: formatDateTimeLocalized(record.created_at, locale) })}</div>
        {record.updated_by && (
          <div>{t('pdf.updatedByAt', { by: record.updated_by, at: formatDateTimeLocalized(record.updated_at, locale) })}</div>
        )}
      </Card>
      </div>
    </div>
  );
}

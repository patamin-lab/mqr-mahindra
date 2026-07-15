'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalLoading, swalClose, swalSuccessToast, swalErrorToast } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { isNonEmptyString } from '../utils/validation';
import { isValidThaiMobile } from '@/lib/validation';
import type { MaintenanceRecord } from '../types';
import type { PmInterval } from '@/lib/types';
import type { AttachmentType } from '@/shared/attachments';
import { uploadAttachment, newPendingEntityId } from '@/components/shared/attachments/uploadAttachment';
import AttachmentPhotoTile from '@/components/shared/attachments/AttachmentPhotoTile';
import TextField from '@/components/shared/forms/TextField';
import SelectField from '@/components/shared/forms/SelectField';
import GpsLocationPicker from '@/components/shared/gps/GpsLocationPicker';
import type { GpsLocation } from '@/components/shared/gps/types';

type PhotoSlot = 'meter' | 'nameplate' | 'report';
const PHOTO_ATTACHMENT_TYPE: Record<PhotoSlot, AttachmentType> = {
  meter: 'MeterPhoto',
  nameplate: 'NameplatePhoto',
  report: 'ReportPhoto',
};

export interface MaintenanceFormInitial {
  dealer_id?: string | null;
  branch_id?: string | null;
  serial?: string | null;
  model?: string | null;
  technician_id?: string | null;
  scheduled_date?: string | null;
  performed_date?: string | null;
  status?: string;
  notes?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  hour_meter?: number | null;
  pm_interval_id?: string | null;
  meter_photo_url?: string | null;
  nameplate_photo_url?: string | null;
  report_photo_url?: string | null;
  meter_photo_attachment_id?: string | null;
  nameplate_photo_attachment_id?: string | null;
  report_photo_attachment_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  google_maps_url?: string | null;
}

/** Discriminated on `mode` so `recordId` is compiler-enforced as required
 *  for 'edit' (a PUT with no id would be a bug, not a runtime option). */
export type MaintenanceFormProps =
  | {
      mode: 'create';
      /** A privileged actor may set an arbitrary dealer_id; only rendered/sent in 'create' mode. */
      showDealerField: boolean;
    }
  | {
      mode: 'edit';
      /** MaintenanceRecordUpdateInput has no dealer_id field at all, so 'edit' mode never shows or sends it. */
      showDealerField: boolean;
      recordId: string;
      initial?: MaintenanceFormInitial;
      /** Server-computed via `evaluateMaintenanceLock()` - when true, the
       *  two calculation-affecting fields this form exposes (Serial,
       *  Performed Date) are disabled. Notes/Status/other non-calculation
       *  fields stay editable even on a locked record. The API enforces
       *  this independently either way - this is UX only. */
      locked?: boolean;
    };

export default function MaintenanceForm(props: MaintenanceFormProps) {
  const { mode, showDealerField } = props;
  const { t } = useTranslation();
  const initial = props.mode === 'edit' ? props.initial : undefined;
  const locked = props.mode === 'edit' && (props.locked ?? false);
  const router = useRouter();
  const [dealerId, setDealerId] = useState(initial?.dealer_id ?? '');
  const [branchId, setBranchId] = useState(initial?.branch_id ?? '');
  const [serial, setSerial] = useState(initial?.serial ?? '');
  const [technicianId, setTechnicianId] = useState(initial?.technician_id ?? '');
  const [scheduledDate, setScheduledDate] = useState(initial?.scheduled_date ?? '');
  const [performedDate, setPerformedDate] = useState(initial?.performed_date ?? '');
  const [status, setStatus] = useState(initial?.status ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [customerName, setCustomerName] = useState(initial?.customer_name ?? '');
  const [customerPhone, setCustomerPhone] = useState(initial?.customer_phone ?? '');
  const [hourMeter, setHourMeter] = useState(initial?.hour_meter != null ? String(initial.hour_meter) : '');
  const [pmIntervalId, setPmIntervalId] = useState(initial?.pm_interval_id ?? '');
  const [pmIntervals, setPmIntervals] = useState<PmInterval[]>([]);
  // Uploaded via AttachmentService; in 'create' mode the record doesn't
  // exist yet, so uploads go against this temporary ID and get re-tagged
  // with the real record id once saved (see /api/pm-records POST route).
  const pendingEntityId = useRef(newPendingEntityId()).current;
  const entityId = props.mode === 'edit' ? props.recordId : pendingEntityId;
  const [photos, setPhotos] = useState<Record<PhotoSlot, { url: string | null; attachmentId: string | null }>>({
    meter: { url: initial?.meter_photo_url ?? null, attachmentId: initial?.meter_photo_attachment_id ?? null },
    nameplate: { url: initial?.nameplate_photo_url ?? null, attachmentId: initial?.nameplate_photo_attachment_id ?? null },
    report: { url: initial?.report_photo_url ?? null, attachmentId: initial?.report_photo_attachment_id ?? null },
  });
  const [uploadingSlot, setUploadingSlot] = useState<PhotoSlot | null>(null);
  const [gps, setGps] = useState<GpsLocation>({
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
    accuracy: initial?.gps_accuracy ?? null,
    googleMapsUrl: initial?.google_maps_url ?? null,
  });
  const [submitting, setSubmitting] = useState(false);

  const showDealerInput = mode === 'create' && showDealerField;
  const cancelHref = props.mode === 'create' ? '/pm-records' : `/pm-records/${encodeURIComponent(props.recordId)}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (initial?.model) params.set('model', initial.model);
        const json = await fetchJson<{ ok: boolean; pmIntervals: PmInterval[] }>(
          `/api/pm-intervals?${params.toString()}`
        );
        if (!cancelled) setPmIntervals(json.pmIntervals ?? []);
      } catch {
        if (!cancelled) setPmIntervals([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial?.model]);

  async function uploadPhoto(slot: PhotoSlot, file: File) {
    setUploadingSlot(slot);
    try {
      const uploaded = await uploadAttachment(file, {
        module: 'pm',
        entityType: 'pm_record',
        entityId,
        attachmentType: PHOTO_ATTACHMENT_TYPE[slot],
        label: slot,
      });
      setPhotos((prev) => ({ ...prev, [slot]: { url: uploaded.url, attachmentId: uploaded.attachmentId } }));
    } catch (err) {
      await swalErrorToast(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setUploadingSlot(null);
    }
  }

  async function onSubmit() {
    if (showDealerInput && !isNonEmptyString(dealerId)) {
      swalErrorToast(t('validation.requiredField', { field: t('pmDetail.dealerId') }));
      return;
    }
    if (!isNonEmptyString(status)) {
      swalErrorToast(t('validation.requiredField', { field: t('common.status') }));
      return;
    }
    if (!isNonEmptyString(customerName)) {
      swalErrorToast(t('validation.enterCustomerName'));
      return;
    }
    if (!isValidThaiMobile(customerPhone)) {
      swalErrorToast(t('validation.invalidPhone'));
      return;
    }
    if (!hourMeter.trim() || Number.isNaN(Number(hourMeter))) {
      swalErrorToast(t('validation.enterHourMeter'));
      return;
    }

    const payload: Record<string, unknown> = {
      branch_id: branchId.trim() || null,
      technician_id: technicianId.trim() || null,
      scheduled_date: scheduledDate.trim() || null,
      status: status.trim(),
      notes: notes.trim() || null,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      hour_meter: Number(hourMeter),
      pm_interval_id: pmIntervalId.trim() || null,
      meter_photo_url: photos.meter.url,
      nameplate_photo_url: photos.nameplate.url,
      report_photo_url: photos.report.url,
      meter_photo_attachment_id: photos.meter.attachmentId,
      nameplate_photo_attachment_id: photos.nameplate.attachmentId,
      report_photo_attachment_id: photos.report.attachmentId,
      latitude: gps.latitude,
      longitude: gps.longitude,
      gps_accuracy: gps.accuracy,
      google_maps_url: gps.googleMapsUrl,
    };
    if (showDealerInput) {
      payload.dealer_id = dealerId.trim();
    }
    // Calculation-affecting fields are omitted entirely (not just left
    // unchanged) when locked, so a locked record's edit still goes through
    // for the fields that are actually being changed (e.g. notes) instead
    // of being rejected server-side just for including these keys
    // unmodified - see MaintenanceService.update()'s touchesLockAffectingFields() guard.
    if (!locked) {
      payload.serial = serial.trim() || null;
      if (mode === 'edit') {
        payload.performed_date = performedDate.trim() || null;
      }
    }

    setSubmitting(true);
    swalLoading(t('common.saving'));
    try {
      const url =
        props.mode === 'create' ? '/api/pm-records' : `/api/pm-records/${encodeURIComponent(props.recordId)}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const result = await fetchJson<{ ok: true; data: MaintenanceRecord }>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      swalClose();
      swalSuccessToast(t('common.success'));
      if (mode === 'create') {
        router.push('/pm-records');
      } else {
        router.push(`/pm-records/${encodeURIComponent(result.data.id)}`);
      }
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        swalErrorToast(t('validation.sessionExpired'));
      } else {
        swalErrorToast(err instanceof Error ? err.message : t('common.error'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const pmIntervalOptions = [
    { value: '', label: t('pmEdit.selectPmIntervalOption') },
    ...pmIntervals.map((iv) => ({
      value: iv.id,
      label: `${iv.label}${iv.interval_hours ? ` (${iv.interval_hours})` : ''}`,
    })),
  ];

  return (
    <div className="space-y-4 rounded border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        {showDealerInput && (
          <TextField
            label={t('pmDetail.dealerId')}
            value={dealerId}
            onChange={setDealerId}
            placeholder={t('pmEdit.dealerIdPlaceholder')}
            disabled={submitting}
          />
        )}
        <TextField
          label={t('pmDetail.branchId')}
          value={branchId}
          onChange={setBranchId}
          placeholder={t('pmEdit.branchIdPlaceholder')}
          disabled={submitting}
        />
        <TextField
          label={locked ? `${t('common.serial')}${t('pmEdit.lockedFieldSuffix')}` : t('common.serial')}
          value={serial}
          onChange={setSerial}
          placeholder={t('pmEdit.serialPlaceholder')}
          disabled={submitting || locked}
        />
        <TextField
          label={t('pmDetail.technicianId')}
          value={technicianId}
          onChange={setTechnicianId}
          placeholder={t('pmEdit.technicianIdPlaceholder')}
          disabled={submitting}
        />
        <TextField
          label={t('pdf.customerName')}
          value={customerName}
          onChange={setCustomerName}
          disabled={submitting}
        />
        <TextField
          label={t('pdf.customerPhone')}
          value={customerPhone}
          onChange={setCustomerPhone}
          placeholder={t('pmEdit.customerPhonePlaceholder')}
          disabled={submitting}
        />
        <TextField
          label={t('common.hourMeter')}
          value={hourMeter}
          onChange={setHourMeter}
          disabled={submitting}
        />
        <SelectField
          label={t('pdf.pmInterval')}
          value={pmIntervalId}
          onChange={setPmIntervalId}
          options={pmIntervalOptions}
        />
        <TextField
          label={t('pmDetail.scheduledDate')}
          value={scheduledDate}
          onChange={setScheduledDate}
          placeholder={t('pmEdit.scheduledDatePlaceholder')}
          disabled={submitting}
        />
        {mode === 'edit' && (
          <TextField
            label={locked ? `${t('common.performedDate')}${t('pmEdit.lockedFieldSuffix')}` : t('common.performedDate')}
            value={performedDate}
            onChange={setPerformedDate}
            placeholder={t('pmEdit.performedDatePlaceholder')}
            disabled={submitting || locked}
          />
        )}
        <TextField
          label={t('common.status')}
          value={status}
          onChange={setStatus}
          placeholder={t('pmEdit.statusPlaceholder')}
          disabled={submitting}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">{t('pmEdit.gpsSectionTitle')}</h2>
        <GpsLocationPicker value={gps} onChange={setGps} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">{t('pmEdit.photosSectionTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['report', 'meter', 'nameplate'] as PhotoSlot[]).map((slot) => (
            <AttachmentPhotoTile
              key={slot}
              label={t(`pdf.photo${slot === 'meter' ? 'Meter' : slot === 'nameplate' ? 'Nameplate' : 'Report'}`)}
              required={slot === 'report'}
              url={photos[slot].url}
              uploading={uploadingSlot === slot}
              disabled={submitting || uploadingSlot === slot}
              noPhotoYetText={t('pmEdit.noPhotoYet')}
              uploadingText={t('pmEdit.uploading')}
              optionalText={t('common.optional')}
              onSelect={(file) => uploadPhoto(slot, file)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">{t('common.notes')}</label>
        <textarea
          className="w-full rounded border px-2 py-1.5 text-sm disabled:opacity-50"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('pmEdit.notesPlaceholder')}
          disabled={submitting}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Link
          href={submitting ? '#' : cancelHref}
          aria-disabled={submitting}
          className={`rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 ${
            submitting ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {t('common.cancel')}
        </Link>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}

'use client';

/**
 * NTR Form - One Form, Dual Mode (Production Pilot readiness). The exact
 * same customer/delivery/GPS/attachments capture the "New NTR" flow
 * always used, now shared with Edit instead of a second, smaller
 * implementation (`NtrEditForm.tsx`, retired). Reused verbatim for both
 * modes: `mode="create"` (from `ntr-search.tsx`, after a tractor is
 * selected/created) and `mode="edit"` (from `/ntr/[id]/edit`, pre-filled
 * from the existing record).
 *
 * Vehicle Master / Factory Domain fields (Serial, Engine Number, Model,
 * Product Family, Sub Model, Product Code, Dealer) are read-only in both
 * modes, always - they come only from Tractor IN / the record's own
 * creation-time dealer, never duplicated or overwritten by this form
 * (`docs/business/FIELD_OWNERSHIP_MATRIX.md`). Branch is editable in
 * Edit mode (a dealer-internal correction, not a Factory Domain field)
 * via a plain dealer-scoped dropdown - not the full `DealerBranchSelector`
 * used at create time (that widget's own role-based dealer-switching
 * doesn't apply once a record's dealer is already fixed).
 */
import { useRef, useState } from 'react';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { isValidThaiMobile } from '@/lib/validation';
import { seesAllDealers } from '@/lib/scope';
import { swalConfirm, swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import TextField from '@/components/shared/forms/TextField';
import SelectField from '@/components/shared/forms/SelectField';
import AddressSelector, { type AddressValue } from '@/components/shared/scope/AddressSelector';
import { useDealerBranchScope } from '@/components/shared/scope/useDealerBranchScope';
import GpsLocationPicker from '@/components/shared/gps/GpsLocationPicker';
import { readGpsFromImageFile } from '@/components/shared/gps/exif';
import { googleMapsUrlFor, type GpsLocation } from '@/components/shared/gps/types';
import { uploadAttachment, newPendingEntityId } from '@/components/shared/attachments/uploadAttachment';
import { processImageForUpload } from '@/components/shared/attachments/imageProcessing';
import AttachmentPhotoTile from '@/components/shared/attachments/AttachmentPhotoTile';
import type { AttachmentType } from '@/shared/attachments';
import { CUSTOMER_TYPE_VALUES, type CustomerType } from '@/shared/master-data/lookup/customerType';
import { CUSTOMER_TITLE_VALUES, CUSTOMER_TITLE_LABELS_TH } from '@/shared/master-data/lookup/customerTitle';
import type { Branch, Dealer, Role } from '@/lib/types';
import type { NtrTractorSearchResult } from '@/lib/db';
import type { NtrAdditionalPhoto, NtrAttachmentType, NtrRecord } from '../types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_GPS: GpsLocation = { latitude: null, longitude: null, accuracy: null, googleMapsUrl: null };

type RequiredPhotoSlot = 'customer_id' | 'serial_plate' | 'signed_document';
const REQUIRED_PHOTO_ATTACHMENT_TYPE: Record<RequiredPhotoSlot, AttachmentType> = {
  customer_id: 'CustomerIdCardPhoto',
  serial_plate: 'SerialPlatePhoto',
  signed_document: 'DeliverySheetPhoto',
};
type OptionalDedicatedSlot = 'hour_meter';
const OPTIONAL_DEDICATED_ATTACHMENT_TYPE: Record<OptionalDedicatedSlot, AttachmentType> = {
  hour_meter: 'HourMeterPhoto',
};
type OptionalTaggedSlot = 'booking_document' | 'tax_invoice' | 'crm_lead';
const OPTIONAL_TAGGED_ATTACHMENT_TYPE: Record<OptionalTaggedSlot, AttachmentType> = {
  booking_document: 'BookingDocumentPhoto',
  tax_invoice: 'TaxInvoicePhoto',
  crm_lead: 'CrmLeadScreenshotPhoto',
};
const OPTIONAL_TAGGED_NTR_TYPE: Record<OptionalTaggedSlot, NtrAttachmentType> = {
  booking_document: 'BOOKING_DOCUMENT',
  tax_invoice: 'TAX_INVOICE',
  crm_lead: 'CRM_LEAD',
};

type PhotoSlot = RequiredPhotoSlot | OptionalDedicatedSlot | OptionalTaggedSlot;
const REQUIRED_PHOTO_SLOTS: RequiredPhotoSlot[] = ['customer_id', 'serial_plate', 'signed_document'];
const OPTIONAL_DEDICATED_SLOTS: OptionalDedicatedSlot[] = ['hour_meter'];
const OPTIONAL_TAGGED_SLOTS: OptionalTaggedSlot[] = ['booking_document', 'tax_invoice', 'crm_lead'];

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

/** Read-only Vehicle Master display data - resolved server-side (create:
 *  `NtrTractorSearchResult`'s own embed; edit: the edit page resolves the
 *  same names for the existing record) so this form never re-derives or
 *  duplicates a Factory Domain lookup. */
interface NtrFormVehicleInfo {
  serial: string;
  model: string | null;
  engineNumber: string | null;
  productCode: string | null;
  dealerLabel: string | null;
  productFamilyName: string | null;
  subModel: string | null;
}

type NtrFormProps =
  | {
      mode: 'create';
      tractor: NtrTractorSearchResult;
      /** Full active dealer list - only non-empty for a role that
       *  `seesAllDealers` (mirrors `ntr/new/page.tsx`'s own
       *  `showDealerField` gate); a pinned role never receives the full
       *  list, so it can't leak via this form either. */
      dealers: Dealer[];
      role: Role;
      sessionDealerId: string | null;
      /** Display name for a pinned dealer (DealerAdmin/DealerUser) - same
       *  reason `DealerBranchSelector` takes this prop instead of looking
       *  it up itself (the hook never populates `availableDealers` for a
       *  pinned role). */
      pinnedDealerName?: string | null;
      /** Prefills Salesperson for a dealer-side actor registering their
       *  own delivery - MSEAL has no personal dealer/salesperson identity,
       *  so it stays blank/free-entry for them (see `validate()`). */
      sessionFullName: string;
      onBack: () => void;
      onSaved: (record: NtrRecord) => void;
    }
  | {
      mode: 'edit';
      record: NtrRecord;
      vehicleInfo: NtrFormVehicleInfo;
      /** The record's own dealer's branches - the initial Branch option
       *  list. Superseded client-side (never refetched from these props
       *  again) once a `seesAllDealers` actor picks a *different* dealer -
       *  see the Dealer field's `onChange` below. */
      branches: Branch[];
      /** Full active dealer list - same `seesAllDealers`-gated shape as
       *  Create mode's own `dealers` prop; only non-empty for a role that
       *  may actually change Dealer here. */
      dealers: Dealer[];
      role: Role;
      /** The *acting* session's own dealer (not the record's) - needed so
       *  a pinned actor is validated against their own dealer, not
       *  whatever this record happens to belong to (those two are always
       *  equal in practice, since a pinned role can only ever reach this
       *  page for their own dealer's record - `canAccessDealerBranch` -
       *  but the field stays explicit rather than assumed). */
      sessionDealerId: string | null;
      onSaved: (record: NtrRecord) => void;
    };

export default function NtrForm(props: NtrFormProps) {
  const { t } = useTranslation();
  const isEdit = props.mode === 'edit';
  const record = isEdit ? props.record : null;

  const [branchId, setBranchId] = useState(isEdit ? props.record.branch_id ?? '' : '');
  // Salesperson: a dealer-side actor (DealerAdmin/DealerUser) registering
  // their own delivery defaults to their own name (still a free-text
  // field, editable - a DealerUser account is a shared branch/team login,
  // not always one individual, per `useDealerBranchScope`'s own doc
  // comment, so locking it outright would be wrong). MSEAL
  // (`seesAllDealers`) has no personal dealer/salesperson identity and
  // starts blank. Edit mode always keeps the record's own existing value -
  // never overwritten by whoever happens to be editing it.
  const [salesperson, setSalesperson] = useState(
    record?.salesperson ?? (props.mode === 'create' && !seesAllDealers(props.role) ? props.sessionFullName : '')
  );
  const [customerTitle, setCustomerTitle] = useState(record?.customer_title ?? '');
  const [customerFirstName, setCustomerFirstName] = useState(record?.customer_first_name ?? '');
  const [customerLastName, setCustomerLastName] = useState(record?.customer_last_name ?? '');
  const [customerName, setCustomerName] = useState(record?.customer_name ?? '');
  const [customerPhone, setCustomerPhone] = useState(record?.customer_phone ?? '');
  const [addressValue, setAddressValue] = useState<AddressValue>({
    address: record?.customer_address ?? '',
    province: record?.customer_province ?? '',
    district: record?.customer_district ?? '',
    subdistrict: record?.customer_subdistrict ?? '',
    postalCode: record?.customer_postal_code ?? '',
  });
  const [customerType, setCustomerType] = useState<CustomerType | ''>(record?.customer_type ?? '');
  // Delivery Date (NTR Form Update, 2026-07) - always an editable date
  // input in both modes, never a read-only echo of the Tractor IN sheet's
  // `vehicles.delivery_date` (the operator must be able to correct a wrong
  // or not-yet-synced sync value). Still pre-filled from the Tractor's own
  // delivery_date when Tractor IN already has it (the best available
  // default), falling back to today otherwise. Edit mode always starts
  // from the record's own existing delivery_date (a correction to what
  // NTR itself recorded - does not cascade to `vehicles.delivery_date`,
  // which stays whatever Warranty Activation already set; see ADR-037).
  const [deliveryDate, setDeliveryDate] = useState(
    isEdit ? props.record.delivery_date.slice(0, 10) : props.tractor.delivery_date ?? todayIso()
  );
  const [hourMeter, setHourMeter] = useState(record?.hour_meter != null ? String(record.hour_meter) : '');
  // Dealer (NTR Form Update, 2026-07) - editable in both modes now. Reuses
  // the same Dealer/Branch Scope Platform Standard hook every other
  // dealer-switching UI in the app already uses (`ntr-search.tsx`'s own
  // `DealerBranchSelector`), just for its Dealer half - Branch has its own
  // separate cascade below rather than this hook's Branch half, since the
  // hook additionally pins *Branch* for `DealerUser` specifically, which
  // would regress this form's existing (unrelated to Dealer) behavior of
  // letting every role freely pick among their own dealer's branches.
  // Initial value: the acting user's own dealer on Create (nothing to
  // default from yet); the record's actual current dealer on Edit
  // ("existing data must display correctly").
  const dealerScope = useDealerBranchScope({
    role: props.role,
    sessionDealerId: props.sessionDealerId,
    sessionBranchId: null,
    initialDealers: props.dealers,
    initialDealerId: props.mode === 'create' ? props.sessionDealerId : props.record.dealer_id,
  });
  // A pinned role's `dealer_id` is always their own session dealer - never
  // resolvable via `dealerScope.currentDealer` (its `availableDealers` is
  // deliberately `[]` for a pinned role, so it can never leak the full
  // dealer list to a non-privileged session). The server ignores/pins
  // this value anyway for a non-privileged role on create
  // (`resolveDealerScope`) and strips it entirely on update
  // (`api/ntr-records/[id]/route.ts`), so sending the raw session dealer
  // id here is always correct. For an unpinned (`seesAllDealers`) actor,
  // fall back to the record's own dealer_id in Edit mode if it somehow
  // isn't in `availableDealers` (e.g. a since-deactivated dealer) - never
  // silently show/submit nothing for an existing, valid record.
  const selectedDealerId = dealerScope.isDealerPinned
    ? props.sessionDealerId
    : dealerScope.currentDealer?.id ?? (props.mode === 'edit' ? props.record.dealer_id : null);
  // Branch (Edit mode only) - starts from the record's own dealer's
  // branches (server-fetched, `props.branches`). Only re-fetched when a
  // `seesAllDealers` actor picks a *different* dealer than the record's
  // original one; switching back restores the original list/selection
  // exactly, with no extra fetch.
  const [editBranches, setEditBranches] = useState<Branch[]>(props.mode === 'edit' ? props.branches : []);
  async function handleDealerChange(newDealerId: string | null) {
    await dealerScope.changeDealer(newDealerId);
    if (props.mode !== 'edit') return;
    if (newDealerId === props.record.dealer_id) {
      setEditBranches(props.branches);
      setBranchId(props.record.branch_id ?? '');
      return;
    }
    setBranchId('');
    if (!newDealerId) {
      setEditBranches([]);
      return;
    }
    try {
      const json = await fetchJson<{ branches: Branch[] }>(`/api/branches?dealerId=${encodeURIComponent(newDealerId)}`);
      setEditBranches(json.branches ?? []);
    } catch {
      setEditBranches([]);
    }
  }
  const [gps, setGps] = useState<GpsLocation>(
    record
      ? {
          latitude: record.latitude,
          longitude: record.longitude,
          accuracy: record.gps_accuracy,
          googleMapsUrl: record.google_maps_url,
        }
      : EMPTY_GPS
  );
  // Edit mode uploads new attachments against the record's own (already
  // real) id - never a pending placeholder, since the record already
  // exists.
  const pendingEntityId = useRef(isEdit ? props.record.id : newPendingEntityId()).current;
  const [photos, setPhotos] = useState<Record<PhotoSlot, { url: string | null; attachmentId: string | null }>>(() => {
    if (!record) {
      return {
        customer_id: { url: null, attachmentId: null },
        serial_plate: { url: null, attachmentId: null },
        hour_meter: { url: null, attachmentId: null },
        signed_document: { url: null, attachmentId: null },
        booking_document: { url: null, attachmentId: null },
        tax_invoice: { url: null, attachmentId: null },
        crm_lead: { url: null, attachmentId: null },
      };
    }
    const findTagged = (type: NtrAttachmentType) => record.additional_photos.find((p) => p.type === type) ?? null;
    const booking = findTagged('BOOKING_DOCUMENT');
    const tax = findTagged('TAX_INVOICE');
    const crm = findTagged('CRM_LEAD');
    return {
      customer_id: { url: record.photo_customer_id_url, attachmentId: record.photo_customer_id_attachment_id },
      serial_plate: { url: record.photo_serial_plate_url, attachmentId: record.photo_serial_plate_attachment_id },
      hour_meter: { url: record.photo_hour_meter_url, attachmentId: record.photo_hour_meter_attachment_id },
      signed_document: { url: record.photo_signed_document_url, attachmentId: record.photo_signed_document_attachment_id },
      booking_document: { url: booking?.url ?? null, attachmentId: booking?.attachmentId ?? null },
      tax_invoice: { url: tax?.url ?? null, attachmentId: tax?.attachmentId ?? null },
      crm_lead: { url: crm?.url ?? null, attachmentId: crm?.attachmentId ?? null },
    };
  });
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function uploadPhoto(slot: PhotoSlot, attachmentType: AttachmentType, file: File, label: string, offerGps: boolean) {
    setUploadingSlot(slot);
    try {
      const [processed, photoGps] = await Promise.all([
        processImageForUpload(file),
        offerGps && file.type.startsWith('image/') ? readGpsFromImageFile(file) : Promise.resolve(null),
      ]);
      const uploaded = await uploadAttachment(processed, {
        module: 'ntr',
        entityType: 'ntr_record',
        entityId: pendingEntityId,
        attachmentType,
        label,
      });
      setPhotos((prev) => ({ ...prev, [slot]: { url: uploaded.url, attachmentId: uploaded.attachmentId } }));

      if (photoGps) {
        const usePhotoGps = await swalConfirm(
          `${photoGps.latitude.toFixed(6)}, ${photoGps.longitude.toFixed(6)}`,
          { title: t('ntr.gpsFoundInPhotoTitle'), confirmText: t('ntr.useGpsFromPhoto'), cancelText: t('ntr.useCurrentLocation') }
        );
        if (usePhotoGps) {
          setGps({
            latitude: photoGps.latitude,
            longitude: photoGps.longitude,
            accuracy: null,
            googleMapsUrl: googleMapsUrlFor(photoGps.latitude, photoGps.longitude),
          });
        }
      }
    } catch (err) {
      await swalErrorToast(err instanceof Error ? err.message : t('validation.uploadFailed'));
    } finally {
      setUploadingSlot(null);
    }
  }

  function validate(): string | null {
    const hasStructuredName = customerFirstName.trim() || customerLastName.trim();
    if (!customerName.trim() && !hasStructuredName) return t('validation.enterCustomerName');
    if (!isValidThaiMobile(customerPhone)) return t('validation.invalidPhone');
    if (!deliveryDate) return t('validation.specifyDeliveryDate');
    if (deliveryDate > todayIso()) return t('validation.deliveryDateFuture');
    if (!salesperson.trim()) return t('validation.enterSalesperson');
    if (!selectedDealerId) return t('validation.selectDealer');
    if (!isEdit) {
      if (!photos.customer_id.url) return t('validation.uploadCustomerIdPhoto');
      if (!photos.serial_plate.url) return t('validation.uploadSerialPlatePhoto');
      if (!photos.signed_document.url) return t('validation.uploadSignedDocumentPhoto');
    }
    return null;
  }

  async function onSave() {
    const validationError = validate();
    if (validationError) {
      await swalErrorToast(validationError);
      return;
    }
    if (!isEdit) {
      const confirmed = await swalConfirm(t('ntr.confirmCompleteRegistrationBody'), {
        title: t('ntr.confirmCompleteRegistrationTitle'),
        confirmText: t('common.confirm'),
      });
      if (!confirmed) return;
    }

    const composedName = customerName.trim() || [customerTitle, customerFirstName, customerLastName].filter(Boolean).join(' ').trim();
    const additionalPhotos: NtrAdditionalPhoto[] = OPTIONAL_TAGGED_SLOTS.filter((slot) => photos[slot].url).map((slot) => ({
      url: photos[slot].url as string,
      label: t(`ntr.attachmentType_${OPTIONAL_TAGGED_NTR_TYPE[slot]}`),
      type: OPTIONAL_TAGGED_NTR_TYPE[slot],
      attachmentId: photos[slot].attachmentId,
    }));

    const sharedPayload = {
      salesperson: salesperson.trim() || null,
      customer_title: customerTitle.trim() || null,
      customer_first_name: customerFirstName.trim() || null,
      customer_last_name: customerLastName.trim() || null,
      customer_name: composedName,
      customer_phone: customerPhone,
      customer_address: addressValue.address.trim() || null,
      customer_subdistrict: addressValue.subdistrict.trim() || null,
      customer_district: addressValue.district.trim() || null,
      customer_province: addressValue.province.trim() || null,
      customer_postal_code: addressValue.postalCode.trim() || null,
      customer_type: customerType || null,
      delivery_date: deliveryDate,
      hour_meter: hourMeter.trim() ? Number(hourMeter) : null,
      latitude: gps.latitude,
      longitude: gps.longitude,
      gps_accuracy: gps.accuracy,
      google_maps_url: gps.googleMapsUrl,
      photo_customer_id_url: photos.customer_id.url,
      photo_customer_tractor_url: null,
      photo_serial_plate_url: photos.serial_plate.url,
      photo_hour_meter_url: photos.hour_meter.url,
      photo_signed_document_url: photos.signed_document.url,
      photo_customer_id_attachment_id: photos.customer_id.attachmentId,
      photo_customer_tractor_attachment_id: null,
      photo_serial_plate_attachment_id: photos.serial_plate.attachmentId,
      photo_hour_meter_attachment_id: photos.hour_meter.attachmentId,
      photo_signed_document_attachment_id: photos.signed_document.attachmentId,
      additional_photos: additionalPhotos,
    };

    setSubmitting(true);
    swalLoading(t('common.saving'));
    try {
      if (isEdit) {
        const saved = await fetchJson<{ ok: true; data: NtrRecord }>(`/api/ntr-records/${encodeURIComponent(props.record.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            ...sharedPayload,
            // The route strips this for any role that doesn't
            // `seesAllDealers` - always safe to send.
            dealer_id: selectedDealerId,
            branch_id: branchId || null,
          }),
        });
        swalClose();
        swalSuccessToast(t('common.success'));
        props.onSaved(saved.data);
      } else {
        const created = await fetchJson<{ ok: true; data: NtrRecord }>('/api/ntr-records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            ...sharedPayload,
            dealer_id: selectedDealerId,
            // The tractor's own branch only still applies if the operator
            // kept the tractor's own dealer selected - a branch never
            // belongs to more than one dealer, so switching dealer must
            // clear it rather than send a mismatched pair (the API's own
            // `assertBranchAccess` would otherwise reject the whole
            // request with FORBIDDEN_BRANCH).
            branch_id: selectedDealerId === props.tractor.dealer_id ? props.tractor.branch_id : null,
            serial: props.tractor.serial,
            model: props.tractor.model,
            engine_number: props.tractor.engine_number,
            // Product Family / Sub Model come from the selected Tractor -
            // synced from Tractor IN, never chosen by the operator.
            product_family_id: props.tractor.product_family_id,
            variant: props.tractor.sub_model,
            audio_url: null,
          }),
        });
        swalClose();
        swalSuccessToast(t('ntr.registrationCompleteToast'));
        props.onSaved(created.data);
      }
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        await swalErrorToast(t('validation.sessionExpired'));
      } else {
        await swalErrorToast(err instanceof Error ? err.message : t('common.error'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const CUSTOMER_TYPE_TRANSLATION_KEY: Record<CustomerType, string> = {
    Individual: 'ntr.customerTypeIndividual',
    Company: 'ntr.customerTypeCompany',
  };
  const customerTypeOptions = [
    { value: '', label: t('ntr.selectCustomerType') },
    ...CUSTOMER_TYPE_VALUES.map((value) => ({ value, label: t(CUSTOMER_TYPE_TRANSLATION_KEY[value]) })),
  ];

  const requiredPhotoLabels: Record<RequiredPhotoSlot, string> = {
    customer_id: t('pdf.photoCustomerId'),
    serial_plate: t('pdf.photoSerialPlate'),
    signed_document: t('pdf.photoSignedDocument'),
  };
  const optionalDedicatedPhotoLabels: Record<OptionalDedicatedSlot, string> = {
    hour_meter: t('pdf.photoHourMeterNtr'),
  };
  const optionalTaggedPhotoLabels: Record<OptionalTaggedSlot, string> = {
    booking_document: t('ntr.attachmentType_BOOKING_DOCUMENT'),
    tax_invoice: t('ntr.attachmentType_TAX_INVOICE'),
    crm_lead: t('ntr.attachmentType_CRM_LEAD'),
  };

  function slotAttachmentType(slot: PhotoSlot): AttachmentType {
    return (
      (REQUIRED_PHOTO_ATTACHMENT_TYPE as Partial<Record<PhotoSlot, AttachmentType>>)[slot] ??
      (OPTIONAL_DEDICATED_ATTACHMENT_TYPE as Partial<Record<PhotoSlot, AttachmentType>>)[slot] ??
      (OPTIONAL_TAGGED_ATTACHMENT_TYPE as Partial<Record<PhotoSlot, AttachmentType>>)[slot]!
    );
  }

  const vehicle: NtrFormVehicleInfo = isEdit
    ? props.vehicleInfo
    : {
        serial: props.tractor.serial,
        model: props.tractor.model,
        engineNumber: props.tractor.engine_number,
        productCode: props.tractor.product_code,
        dealerLabel: props.tractor.dealer_name ?? props.tractor.dealer_id,
        productFamilyName: props.tractor.product_family_name,
        subModel: props.tractor.sub_model,
      };

  // In Create mode, prefer `pinnedDealerName` (the acting user's own
  // dealer, resolved at the page level via `MasterDataService.getDealerById` -
  // always reliable) over `vehicle.dealerLabel`, which falls back to the
  // raw `dealer_id` code for a brand-new tractor with no Tractor IN sync
  // yet (`ntr-search.tsx`'s `createTractorAndSelect()` has no dealer name
  // to give it). In Edit mode, `vehicle.dealerLabel` is always already a
  // real resolved name (`MasterDataService.getDealerById()` in
  // `edit/page.tsx`), so it's the only source needed there.
  const pinnedDealerLabel = (props.mode === 'create' ? props.pinnedDealerName : null) ?? vehicle.dealerLabel ?? selectedDealerId ?? '-';
  const dealerOptions = dealerScope.isDealerPinned
    ? [{ value: selectedDealerId ?? '', label: pinnedDealerLabel }]
    : [
        { value: '', label: t('ntr.selectDealerPlaceholder') },
        ...dealerScope.availableDealers.map((d: Dealer) => ({ value: d.id, label: d.short_name })),
      ];

  return (
    <div className="max-w-3xl space-y-4">
      {!isEdit && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-brand-dark">
              {t('ntr.registerTitle')}: {vehicle.serial}
            </h1>
            <p className="text-sm text-gray-500">{props.tractor.model ?? '-'}</p>
          </div>
          <button type="button" onClick={props.onBack} disabled={submitting} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
            {t('ntr.backToSearch')}
          </button>
        </div>
      )}

      <div className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.customerInfoTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label={t('csv.customerType')} value={customerType} onChange={(v) => setCustomerType(v as CustomerType | '')} options={customerTypeOptions} disabled={submitting} />
          {customerType === 'Individual' ? (
            <>
              <SelectField
                label={t('csv.customerTitle')}
                value={customerTitle}
                onChange={setCustomerTitle}
                options={[
                  { value: '', label: t('ntr.customerTitlePlaceholder') },
                  ...CUSTOMER_TITLE_VALUES.map((v) => ({ value: CUSTOMER_TITLE_LABELS_TH[v], label: CUSTOMER_TITLE_LABELS_TH[v] })),
                ]}
                disabled={submitting}
              />
              <TextField label={t('csv.customerFirstName')} value={customerFirstName} onChange={setCustomerFirstName} disabled={submitting} />
              <TextField label={t('csv.customerLastName')} value={customerLastName} onChange={setCustomerLastName} disabled={submitting} />
            </>
          ) : (
            <TextField label={`${t('pdf.customerName')} *`} value={customerName} onChange={setCustomerName} disabled={submitting} />
          )}
          <TextField
            label={`${t('pdf.customerPhone')} *`}
            value={customerPhone}
            onChange={(v) => setCustomerPhone(formatPhoneInput(v))}
            placeholder="081-2345678"
            disabled={submitting}
          />
          <AddressSelector value={addressValue} onChange={setAddressValue} disabled={submitting} />
        </div>

        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.tractorInfoTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {/* Vehicle Master / Factory Domain - read-only in both modes,
              always synced from Tractor IN, never chosen or edited here
              (Model/Sub Model/Product Code/Engine Number all resolve from
              the same selected Tractor - see `NtrFormVehicleInfo`). */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('csv.model')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{vehicle.model ?? '-'}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('common.engineNumber')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{vehicle.engineNumber ?? '-'}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('csv.productCode')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{vehicle.productCode ?? '-'}</p>
          </div>
          {/* Dealer (NTR Form Update, 2026-07) - editable, RBAC-gated
              dropdown in both modes now. A pinned role (DealerAdmin/
              DealerUser) always sees a single, disabled option (their own
              dealer, or the record's - guaranteed the same one); only a
              `seesAllDealers` actor can actually pick a different dealer,
              including in Edit mode. */}
          <SelectField
            label={`${t('common.dealer')} *`}
            value={selectedDealerId ?? ''}
            onChange={(v) => void handleDealerChange(v || null)}
            options={dealerOptions}
            disabled={submitting || dealerScope.isDealerPinned}
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('common.productFamily')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{vehicle.productFamilyName ?? '-'}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('ntr.subModel')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{vehicle.subModel ?? '-'}</p>
          </div>
          {/* Branch is dealer-internal, not Factory Domain - editable in
              Edit mode only (create mode already picked it via the
              search step's DealerBranchSelector). */}
          {isEdit && (
            <SelectField
              label={t('common.branch')}
              value={branchId}
              onChange={setBranchId}
              options={[{ value: '', label: t('common.allBranches') }, ...editBranches.map((b) => ({ value: b.id, label: b.name }))]}
              disabled={submitting}
            />
          )}
        </div>

        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.deliveryInfoTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{`${t('csv.deliveryDate')} *`}</label>
            <input
              type="date"
              required
              max={todayIso()}
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              disabled={submitting}
            />
          </div>
          <TextField label={t('pdf.hourMeter')} value={hourMeter} onChange={setHourMeter} disabled={submitting} />
          <TextField label={`${t('csv.salesperson')} *`} value={salesperson} onChange={setSalesperson} disabled={submitting} />
        </div>

        <h2 className="text-sm font-semibold text-gray-600">{t('pdf.gpsLocation')}</h2>
        <GpsLocationPicker value={gps} onChange={setGps} />

        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.attachmentsTitle')}</h2>
        <p className="text-xs text-gray-500">{t('ntr.requiredAttachmentsTitle')}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          {REQUIRED_PHOTO_SLOTS.map((slot) => (
            <AttachmentPhotoTile
              key={slot}
              label={requiredPhotoLabels[slot]}
              required
              url={photos[slot].url}
              uploading={uploadingSlot === slot}
              disabled={submitting || uploadingSlot === slot}
              noPhotoYetText={t('ntr.noPhotoYet')}
              uploadingText={t('ntr.uploading')}
              optionalText={t('common.optional')}
              onSelect={(file) => uploadPhoto(slot, slotAttachmentType(slot), file, requiredPhotoLabels[slot], true)}
            />
          ))}
        </div>

        <p className="text-xs text-gray-500">{t('ntr.optionalAttachmentsTitle')}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          {OPTIONAL_DEDICATED_SLOTS.map((slot) => (
            <AttachmentPhotoTile
              key={slot}
              label={optionalDedicatedPhotoLabels[slot]}
              required={false}
              url={photos[slot].url}
              uploading={uploadingSlot === slot}
              disabled={submitting || uploadingSlot === slot}
              noPhotoYetText={t('ntr.noPhotoYet')}
              uploadingText={t('ntr.uploading')}
              optionalText={t('common.optional')}
              onSelect={(file) => uploadPhoto(slot, slotAttachmentType(slot), file, optionalDedicatedPhotoLabels[slot], true)}
            />
          ))}
          {OPTIONAL_TAGGED_SLOTS.map((slot) => (
            <AttachmentPhotoTile
              key={slot}
              label={optionalTaggedPhotoLabels[slot]}
              required={false}
              url={photos[slot].url}
              uploading={uploadingSlot === slot}
              disabled={submitting || uploadingSlot === slot}
              noPhotoYetText={t('ntr.noPhotoYet')}
              uploadingText={t('ntr.uploading')}
              optionalText={t('common.optional')}
              onSelect={(file) => uploadPhoto(slot, slotAttachmentType(slot), file, optionalTaggedPhotoLabels[slot], false)}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onSave} disabled={submitting} className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-50">
            {submitting ? t('common.saving') : isEdit ? t('common.save') : t('ntr.completeRegistrationButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

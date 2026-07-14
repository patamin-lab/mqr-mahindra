'use client';

/**
 * NTR search-first workflow: Search Tractor -> Existing Tractor or Create
 * Tractor -> Customer Information -> Delivery Information -> Attachments ->
 * Complete Registration. Mirrors
 * `features/maintenance/components/maintenance-search.tsx`'s shape and
 * reuses the exact same shared components (TextField/SelectField/
 * GpsLocationPicker/EXIF-photo-GPS offer/upload pattern) rather than a
 * parallel implementation.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import TextField from '@/components/shared/forms/TextField';
import SelectField from '@/components/shared/forms/SelectField';
import { useDealerBranchScope } from '@/components/shared/scope/useDealerBranchScope';
import DealerBranchSelector from '@/components/shared/scope/DealerBranchSelector';
import AddressSelector, { type AddressValue } from '@/components/shared/scope/AddressSelector';
import GpsLocationPicker from '@/components/shared/gps/GpsLocationPicker';
import { readGpsFromImageFile } from '@/components/shared/gps/exif';
import { googleMapsUrlFor, type GpsLocation } from '@/components/shared/gps/types';
import { uploadAttachment, newPendingEntityId } from '@/components/shared/attachments/uploadAttachment';
import { processImageForUpload } from '@/components/shared/attachments/imageProcessing';
import AttachmentPhotoTile from '@/components/shared/attachments/AttachmentPhotoTile';
import type { AttachmentType } from '@/shared/attachments';
// Client Component - imports the two Lookup Platform submodules directly
// rather than the full `MasterDataService` facade. The facade also pulls
// in the Address Platform (a ~3.5MB Thai address JSON) and the Reference
// Data Platform (`lib/db`/`@supabase/supabase-js`), which would otherwise
// get bundled into this page's client JS even though neither is used here
// (address lookups go through `AddressSelector`'s `/api/master/*` calls
// instead) - a documented exception to "always import the facade", same
// category as `AttachmentService`'s own operational-surface exception.
import { CUSTOMER_TYPE_VALUES, type CustomerType } from '@/shared/master-data/lookup/customerType';
import { CUSTOMER_TITLE_VALUES, CUSTOMER_TITLE_LABELS_TH } from '@/shared/master-data/lookup/customerTitle';
import type { Dealer, Role } from '@/lib/types';
import type { NtrTractorSearchResult } from '@/lib/db';
import type { NtrAdditionalPhoto, NtrAttachmentType, NtrRecord } from '../types';

const EMPTY_GPS: GpsLocation = { latitude: null, longitude: null, accuracy: null, googleMapsUrl: null };

/** The 3 required attachments (Enterprise UI/UX Standardization -
 *  Attachment Standard) - each backed by its own dedicated column.
 *  `CustomerTractorPhoto` ("Customer with Tractor") is fully removed
 *  from this form per that standard - no longer offered on create,
 *  though the column/existing data on older records is untouched. */
type RequiredPhotoSlot = 'customer_id' | 'serial_plate' | 'signed_document';
const REQUIRED_PHOTO_ATTACHMENT_TYPE: Record<RequiredPhotoSlot, AttachmentType> = {
  customer_id: 'CustomerIdCardPhoto',
  serial_plate: 'SerialPlatePhoto',
  signed_document: 'DeliverySheetPhoto',
};

/** Optional, but still with its own dedicated column (demoted from
 *  required by the Attachment Standard). */
type OptionalDedicatedSlot = 'hour_meter';
const OPTIONAL_DEDICATED_ATTACHMENT_TYPE: Record<OptionalDedicatedSlot, AttachmentType> = {
  hour_meter: 'HourMeterPhoto',
};

/** Optional, no dedicated column - stored as a tagged entry in
 *  `additional_photos` instead (see `NtrAdditionalPhoto.type`). */
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

interface Props {
  dealers: Dealer[];
  role: Role;
  sessionDealerId: string | null;
  sessionBranchId: string | null;
  pinnedDealerName?: string | null;
  pinnedBranchName?: string | null;
}

export default function NtrSearch({ dealers, role, sessionDealerId, sessionBranchId, pinnedDealerName, pinnedBranchName }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'search' | 'form'>('search');

  const scope = useDealerBranchScope({
    role,
    sessionDealerId,
    sessionBranchId,
    initialDealers: dealers,
  });
  const dealerId = scope.currentDealer?.id ?? '';
  const branchId = scope.currentBranch?.id ?? '';
  const [serial, setSerial] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [model, setModel] = useState('');
  const [results, setResults] = useState<NtrTractorSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedTractor, setSelectedTractor] = useState<NtrTractorSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function showError(err: unknown) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalErrorToast(t('validation.sessionExpired'));
    } else {
      await swalErrorToast(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function runSearch() {
    setSearching(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (dealerId) params.set('dealerId', dealerId);
      if (branchId) params.set('branchId', branchId);
      if (serial.trim()) params.set('serial', serial.trim());
      if (engineNumber.trim()) params.set('engineNumber', engineNumber.trim());
      if (model.trim()) params.set('model', model.trim());
      const json = await fetchJson<{ ok: boolean; data: NtrTractorSearchResult[] }>(`/api/ntr/tractor-search?${params.toString()}`);
      setResults(json.data ?? []);
    } catch (err) {
      setResults([]);
      await showError(err);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (serial.trim().length < 3) return;
    debounceRef.current = setTimeout(() => {
      runSearch();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial]);

  function selectTractor(tractor: NtrTractorSearchResult) {
    setSelectedTractor(tractor);
    setMode('form');
  }

  async function createTractorAndSelect() {
    if (!serial.trim()) {
      await swalErrorToast(t('validation.selectVehicle'));
      return;
    }
    swalLoading(t('common.saving'));
    try {
      const created = await fetchJson<{ ok: true; data: { id: string; serial: string; model: string | null; engine_number: string | null; dealer_id: string | null } }>(
        '/api/ntr/tractors',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            serial: serial.trim(),
            model: model.trim() || null,
            engine_number: engineNumber.trim() || null,
            branch_id: branchId || null,
            delivery_date: null,
            dealer_id: dealerId || undefined,
          }),
        }
      );
      swalClose();
      selectTractor({
        id: created.data.id,
        serial: created.data.serial,
        model: created.data.model,
        engine_number: created.data.engine_number,
        delivery_date: null,
        dealer_id: created.data.dealer_id,
        dealer_name: null,
        branch_id: branchId || null,
        branch_name: null,
        existing_ntr_number: null,
        // A freshly-created tractor has no Tractor IN sync data yet -
        // Product Family/Sub Model/Product Code/WH Arrival Date stay null
        // until the sheet has them and a sync runs (see TractorInSyncService).
        product_family_id: null,
        product_family_name: null,
        sub_model: null,
        product_code: null,
        wh_arrival_date: null,
      });
    } catch (err) {
      swalClose();
      await showError(err);
    }
  }

  if (mode === 'form' && selectedTractor) {
    return (
      <NtrRegistrationForm
        tractor={selectedTractor}
        onBack={() => {
          setMode('search');
          setSelectedTractor(null);
        }}
        onSaved={(record) => router.push(`/ntr/${encodeURIComponent(record.id)}`)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <h1 className="text-lg font-bold text-brand-dark">{t('ntr.searchTitle')}</h1>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <DealerBranchSelector
            scope={scope}
            pinnedDealerName={pinnedDealerName}
            pinnedBranchName={pinnedBranchName}
            dealerLabel={t('common.dealer')}
            branchLabel={t('common.branch')}
            dealerAllLabel={t('common.allDealers')}
            branchAllLabel={t('common.allBranches')}
            className="contents"
          />
          <TextField label={t('csv.serial')} value={serial} onChange={setSerial} placeholder={t('ntr.searchSerialPlaceholder')} />
          <TextField label={t('common.engineNumber')} value={engineNumber} onChange={setEngineNumber} />
          <TextField label={t('csv.model')} value={model} onChange={setModel} />
        </div>
        <div>
          <button type="button" onClick={runSearch} disabled={searching} className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-50">
            {searching ? t('common.searching') : t('common.search')}
          </button>
        </div>
      </div>

      {searched && !searching && results.length === 0 && (
        <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500 space-y-3">
          <p>{t('ntr.noTractorFound')}</p>
          {serial.trim() && (
            <button type="button" onClick={createTractorAndSelect} className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark">
              {t('ntr.createTractorButton')}
            </button>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">{t('csv.serial')}</th>
                <th className="px-3 py-2">{t('csv.model')}</th>
                <th className="px-3 py-2">{t('common.dealer')}</th>
                <th className="px-3 py-2">{t('common.branch')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {results.map((v) => (
                <tr key={v.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{v.serial}</td>
                  <td className="px-3 py-2">{v.model ?? '-'}</td>
                  <td className="px-3 py-2">{v.dealer_name ?? v.dealer_id ?? '-'}</td>
                  <td className="px-3 py-2">{v.branch_name ?? '-'}</td>
                  <td className="px-3 py-2">
                    {v.existing_ntr_number ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                        {t('validation.tractorAlreadyRegistered', { ntrNumber: v.existing_ntr_number })}
                      </span>
                    ) : (
                      <button type="button" onClick={() => selectTractor(v)} className="rounded bg-brand-red px-3 py-1.5 text-xs text-white hover:bg-brand-dark">
                        {t('common.select')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NtrRegistrationForm({
  tractor,
  onBack,
  onSaved,
}: {
  tractor: NtrTractorSearchResult;
  onBack: () => void;
  onSaved: (record: NtrRecord) => void;
}) {
  const { t } = useTranslation();
  const [salesperson, setSalesperson] = useState('');
  const [customerTitle, setCustomerTitle] = useState('');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [addressValue, setAddressValue] = useState<AddressValue>({ address: '', province: '', district: '', subdistrict: '', postalCode: '' });
  const [customerType, setCustomerType] = useState<CustomerType | ''>('');
  // Delivery Date now auto-fills from Vehicle Master (Tractor IN sheet,
  // `vehicles.delivery_date`) - never duplicated/re-entered once the sheet
  // has it. The manual date input only remains as a fallback for a tractor
  // Tractor IN hasn't synced yet (brand-new arrival), so registration is
  // never blocked on the sheet catching up.
  const [manualDeliveryDate, setManualDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const deliveryDate = tractor.delivery_date ?? manualDeliveryDate;
  const [hourMeter, setHourMeter] = useState('');
  const [gps, setGps] = useState<GpsLocation>(EMPTY_GPS);
  const pendingEntityId = useRef(newPendingEntityId()).current;
  const [photos, setPhotos] = useState<Record<PhotoSlot, { url: string | null; attachmentId: string | null }>>({
    customer_id: { url: null, attachmentId: null },
    serial_plate: { url: null, attachmentId: null },
    hour_meter: { url: null, attachmentId: null },
    signed_document: { url: null, attachmentId: null },
    booking_document: { url: null, attachmentId: null },
    tax_invoice: { url: null, attachmentId: null },
    crm_lead: { url: null, attachmentId: null },
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
    if (!/^0\d{9}$/.test(customerPhone.replace(/\D/g, ''))) return t('validation.invalidPhone');
    if (!deliveryDate) return t('validation.specifyDeliveryDate');
    if (!photos.customer_id.url) return t('validation.uploadCustomerIdPhoto');
    if (!photos.serial_plate.url) return t('validation.uploadSerialPlatePhoto');
    if (!photos.signed_document.url) return t('validation.uploadSignedDocumentPhoto');
    return null;
  }

  async function onSave() {
    const validationError = validate();
    if (validationError) {
      await swalErrorToast(validationError);
      return;
    }
    const confirmed = await swalConfirm(t('ntr.confirmCompleteRegistrationBody'), { title: t('ntr.confirmCompleteRegistrationTitle'), confirmText: t('common.confirm') });
    if (!confirmed) return;

    // Composed client-side too (not just in NtrService) so the required
    // customer_name schema field is satisfied even when the operator only
    // filled Title/First/Last Name and never typed a separate full name -
    // see NtrService's deriveCustomerName() for the server-side version of
    // this same rule (defense in depth, and the only path Legacy Import uses).
    const composedName = customerName.trim() || [customerTitle, customerFirstName, customerLastName].filter(Boolean).join(' ').trim();

    // Optional, no-dedicated-column attachments (Booking Document, Tax
    // Invoice, CRM Lead Screenshot) - only the ones actually uploaded are
    // included, each tagged with its standardized type so the detail page/
    // PDF can label it correctly instead of falling back to "Other".
    const additionalPhotos: NtrAdditionalPhoto[] = OPTIONAL_TAGGED_SLOTS.filter((slot) => photos[slot].url).map((slot) => ({
      url: photos[slot].url as string,
      label: t(`ntr.attachmentType_${OPTIONAL_TAGGED_NTR_TYPE[slot]}`),
      type: OPTIONAL_TAGGED_NTR_TYPE[slot],
      attachmentId: photos[slot].attachmentId,
    }));

    setSubmitting(true);
    swalLoading(t('common.saving'));
    try {
      const created = await fetchJson<{ ok: true; data: NtrRecord }>('/api/ntr-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          dealer_id: tractor.dealer_id,
          branch_id: tractor.branch_id,
          serial: tractor.serial,
          model: tractor.model,
          engine_number: tractor.engine_number,
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
          // Product Family / Sub Model come from the selected Tractor -
          // synced from Tractor IN (TractorInSyncService), never chosen by
          // the operator in this form.
          product_family_id: tractor.product_family_id,
          variant: tractor.sub_model,
          delivery_date: deliveryDate,
          hour_meter: hourMeter.trim() ? Number(hourMeter) : null,
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
          audio_url: null,
          latitude: gps.latitude,
          longitude: gps.longitude,
          gps_accuracy: gps.accuracy,
          google_maps_url: gps.googleMapsUrl,
        }),
      });
      swalClose();
      swalSuccessToast(t('ntr.registrationCompleteToast'));
      onSaved(created.data);
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

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">
            {t('ntr.registerTitle')}: {tractor.serial}
          </h1>
          <p className="text-sm text-gray-500">{tractor.model ?? '-'}</p>
        </div>
        <button type="button" onClick={onBack} disabled={submitting} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
          {t('ntr.backToSearch')}
        </button>
      </div>

      <div className="space-y-3 rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.customerInfoTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label={t('csv.customerType')} value={customerType} onChange={(v) => setCustomerType(v as CustomerType | '')} options={customerTypeOptions} />
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
          {/* Read-only - synced from Tractor IN (TractorInSyncService), never
              chosen by the operator (NTR Form Update, 2026-07). Vehicle
              master data must never be duplicated/re-entered here. */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('common.engineNumber')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{tractor.engine_number ?? '-'}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('csv.productCode')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{tractor.product_code ?? '-'}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('common.dealer')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{tractor.dealer_name ?? tractor.dealer_id ?? '-'}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('common.productFamily')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{tractor.product_family_name ?? '-'}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('ntr.subModel')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{tractor.sub_model ?? '-'}</p>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.deliveryInfoTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{`${t('csv.deliveryDate')} *`}</label>
            {tractor.delivery_date ? (
              <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{tractor.delivery_date}</p>
            ) : (
              <input
                type="date"
                required
                className="w-full rounded border px-2 py-1.5 text-sm"
                value={manualDeliveryDate}
                onChange={(e) => setManualDeliveryDate(e.target.value)}
                disabled={submitting}
              />
            )}
          </div>
          <TextField label={t('pdf.hourMeter')} value={hourMeter} onChange={setHourMeter} disabled={submitting} />
          <TextField label={t('csv.salesperson')} value={salesperson} onChange={setSalesperson} disabled={submitting} />
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
            {submitting ? t('common.saving') : t('ntr.completeRegistrationButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

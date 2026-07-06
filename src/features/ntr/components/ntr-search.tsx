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
import GpsLocationPicker from '@/components/shared/gps/GpsLocationPicker';
import { readGpsFromImageFile } from '@/components/shared/gps/exif';
import { googleMapsUrlFor, type GpsLocation } from '@/components/shared/gps/types';
import { uploadAttachment, newPendingEntityId } from '@/components/shared/attachments/uploadAttachment';
import type { AttachmentType } from '@/shared/attachments';
import type { Dealer, Branch } from '@/lib/types';
import type { NtrTractorSearchResult } from '@/lib/db';
import type { NtrRecord } from '../types';

const EMPTY_GPS: GpsLocation = { latitude: null, longitude: null, accuracy: null, googleMapsUrl: null };

type RequiredPhotoSlot = 'customer_tractor' | 'serial_plate' | 'hour_meter' | 'signed_document';
const REQUIRED_PHOTO_FIELD: Record<RequiredPhotoSlot, string> = {
  customer_tractor: 'photo_customer_tractor_url',
  serial_plate: 'photo_serial_plate_url',
  hour_meter: 'photo_hour_meter_url',
  signed_document: 'photo_signed_document_url',
};
const REQUIRED_PHOTO_ATTACHMENT_TYPE: Record<RequiredPhotoSlot, AttachmentType> = {
  customer_tractor: 'CustomerTractorPhoto',
  serial_plate: 'SerialPlatePhoto',
  hour_meter: 'HourMeterPhoto',
  signed_document: 'DeliverySheetPhoto',
};

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

interface Props {
  dealers: Dealer[];
  showDealerField: boolean;
  defaultDealerId: string | null;
}

export default function NtrSearch({ dealers, showDealerField, defaultDealerId }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'search' | 'form'>('search');

  const [dealerId, setDealerId] = useState(defaultDealerId ?? '');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [serial, setSerial] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [model, setModel] = useState('');
  const [results, setResults] = useState<NtrTractorSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedTractor, setSelectedTractor] = useState<NtrTractorSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!dealerId) {
        setBranches([]);
        return;
      }
      try {
        const json = await fetchJson<{ ok: boolean; branches: Branch[] }>(`/api/branches?dealerId=${encodeURIComponent(dealerId)}`);
        if (!cancelled) setBranches(json.branches ?? []);
      } catch {
        if (!cancelled) setBranches([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dealerId]);

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

  const dealerOptions = [{ value: '', label: t('common.allDealers') }, ...dealers.map((d) => ({ value: d.id, label: d.short_name }))];
  const branchOptions = [{ value: '', label: t('common.allBranches') }, ...branches.map((b) => ({ value: b.id, label: b.name }))];

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <h1 className="text-lg font-bold text-brand-dark">{t('ntr.searchTitle')}</h1>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {showDealerField && (
            <SelectField
              label={t('common.dealer')}
              value={dealerId}
              onChange={(v) => {
                setDealerId(v);
                setBranchId('');
              }}
              options={dealerOptions}
            />
          )}
          <SelectField label={t('common.branch')} value={branchId} onChange={setBranchId} options={branchOptions} />
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
  const [receivingPerson, setReceivingPerson] = useState('');
  const [customerTitle, setCustomerTitle] = useState('');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerSubdistrict, setCustomerSubdistrict] = useState('');
  const [customerDistrict, setCustomerDistrict] = useState('');
  const [customerProvince, setCustomerProvince] = useState('');
  const [customerPostalCode, setCustomerPostalCode] = useState('');
  const [customerType, setCustomerType] = useState<'Individual' | 'Company' | ''>('');
  const [productFamilyId, setProductFamilyId] = useState('');
  const [productFamilies, setProductFamilies] = useState<{ id: string; name: string }[]>([]);
  const [variant, setVariant] = useState('');
  const [retailDate, setRetailDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [pdiDate, setPdiDate] = useState('');
  const [manufacturingYear, setManufacturingYear] = useState('');
  const [hourMeter, setHourMeter] = useState('');
  const [gps, setGps] = useState<GpsLocation>(EMPTY_GPS);

  useEffect(() => {
    (async () => {
      try {
        const json = await fetchJson<{ ok: boolean; productFamilies: { id: string; name: string }[] }>('/api/product-families');
        setProductFamilies(json.productFamilies ?? []);
      } catch {
        setProductFamilies([]);
      }
    })();
  }, []);
  const pendingEntityId = useRef(newPendingEntityId()).current;
  const [photos, setPhotos] = useState<Record<RequiredPhotoSlot, { url: string | null; attachmentId: string | null }>>({
    customer_tractor: { url: null, attachmentId: null },
    serial_plate: { url: null, attachmentId: null },
    hour_meter: { url: null, attachmentId: null },
    signed_document: { url: null, attachmentId: null },
  });
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoAttachmentId, setVideoAttachmentId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function uploadRequiredPhoto(slot: RequiredPhotoSlot, file: File, label: string) {
    setUploadingSlot(slot);
    try {
      const [uploaded, photoGps] = await Promise.all([
        uploadAttachment(file, {
          module: 'ntr',
          entityType: 'ntr_record',
          entityId: pendingEntityId,
          attachmentType: REQUIRED_PHOTO_ATTACHMENT_TYPE[slot],
          label,
        }),
        file.type.startsWith('image/') ? readGpsFromImageFile(file) : Promise.resolve(null),
      ]);
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

  async function uploadVideo(file: File) {
    setUploadingSlot('video');
    try {
      const uploaded = await uploadAttachment(file, {
        module: 'ntr',
        entityType: 'ntr_record',
        entityId: pendingEntityId,
        attachmentType: 'Video',
        label: t('ntr.attachmentsTitle'),
      });
      setVideoUrl(uploaded.url);
      setVideoAttachmentId(uploaded.attachmentId);
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
    if (!photos.customer_tractor.url) return t('validation.uploadCustomerTractorPhoto');
    if (!photos.serial_plate.url) return t('validation.uploadSerialPlatePhoto');
    if (!photos.hour_meter.url) return t('validation.uploadHourMeterPhoto');
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

    setSubmitting(true);
    swalLoading(t('common.saving'));
    try {
      const created = await fetchJson<{ ok: true; data: NtrRecord }>('/api/ntr-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          branch_id: tractor.branch_id,
          serial: tractor.serial,
          model: tractor.model,
          engine_number: tractor.engine_number,
          salesperson: salesperson.trim() || null,
          receiving_person: receivingPerson.trim() || null,
          customer_title: customerTitle.trim() || null,
          customer_first_name: customerFirstName.trim() || null,
          customer_last_name: customerLastName.trim() || null,
          customer_name: composedName,
          customer_phone: customerPhone,
          customer_address: customerAddress.trim() || null,
          customer_subdistrict: customerSubdistrict.trim() || null,
          customer_district: customerDistrict.trim() || null,
          customer_province: customerProvince.trim() || null,
          customer_postal_code: customerPostalCode.trim() || null,
          customer_type: customerType || null,
          product_family_id: productFamilyId || null,
          variant: variant.trim() || null,
          retail_date: retailDate || null,
          delivery_date: deliveryDate,
          pdi_date: pdiDate || null,
          manufacturing_year: manufacturingYear.trim() ? Number(manufacturingYear) : null,
          hour_meter: hourMeter.trim() ? Number(hourMeter) : null,
          photo_customer_tractor_url: photos.customer_tractor.url,
          photo_serial_plate_url: photos.serial_plate.url,
          photo_hour_meter_url: photos.hour_meter.url,
          photo_signed_document_url: photos.signed_document.url,
          photo_customer_tractor_attachment_id: photos.customer_tractor.attachmentId,
          photo_serial_plate_attachment_id: photos.serial_plate.attachmentId,
          photo_hour_meter_attachment_id: photos.hour_meter.attachmentId,
          photo_signed_document_attachment_id: photos.signed_document.attachmentId,
          video_url: videoUrl,
          video_attachment_id: videoAttachmentId,
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

  const customerTypeOptions = [
    { value: '', label: t('ntr.selectCustomerType') },
    { value: 'Individual', label: t('ntr.customerTypeIndividual') },
    { value: 'Company', label: t('ntr.customerTypeCompany') },
  ];

  const requiredPhotoLabels: Record<RequiredPhotoSlot, string> = {
    customer_tractor: t('pdf.photoCustomerTractor'),
    serial_plate: t('pdf.photoSerialPlate'),
    hour_meter: t('pdf.photoHourMeterNtr'),
    signed_document: t('pdf.photoSignedDocument'),
  };

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
          <SelectField label={t('csv.customerType')} value={customerType} onChange={(v) => setCustomerType(v as 'Individual' | 'Company' | '')} options={customerTypeOptions} />
          {customerType === 'Individual' ? (
            <>
              <TextField label={t('csv.customerTitle')} value={customerTitle} onChange={setCustomerTitle} placeholder={t('ntr.customerTitlePlaceholder')} disabled={submitting} />
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
          <TextField label={t('csv.customerAddress')} value={customerAddress} onChange={setCustomerAddress} disabled={submitting} />
          <TextField label={t('csv.subdistrict')} value={customerSubdistrict} onChange={setCustomerSubdistrict} disabled={submitting} />
          <TextField label={t('csv.district')} value={customerDistrict} onChange={setCustomerDistrict} disabled={submitting} />
          <TextField label={t('csv.province')} value={customerProvince} onChange={setCustomerProvince} disabled={submitting} />
          <TextField label={t('csv.postalCode')} value={customerPostalCode} onChange={setCustomerPostalCode} disabled={submitting} />
        </div>

        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.tractorInfoTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <SelectField
            label={t('common.productFamily')}
            value={productFamilyId}
            onChange={setProductFamilyId}
            options={[{ value: '', label: t('ntr.selectProductFamily') }, ...productFamilies.map((f) => ({ value: f.id, label: f.name }))]}
          />
          <TextField label={t('csv.variant')} value={variant} onChange={setVariant} disabled={submitting} />
          <TextField label={t('csv.manufacturingYear')} value={manufacturingYear} onChange={setManufacturingYear} placeholder="2026" disabled={submitting} />
        </div>

        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.deliveryInfoTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('csv.retailDate')}</label>
            <input type="date" className="w-full rounded border px-2 py-1.5 text-sm" value={retailDate} onChange={(e) => setRetailDate(e.target.value)} disabled={submitting} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{`${t('ntr.acceptanceDate')} *`}</label>
            <input type="date" className="w-full rounded border px-2 py-1.5 text-sm" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} disabled={submitting} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('csv.pdiDate')}</label>
            <input type="date" className="w-full rounded border px-2 py-1.5 text-sm" value={pdiDate} onChange={(e) => setPdiDate(e.target.value)} disabled={submitting} />
          </div>
          <TextField label={t('pdf.hourMeter')} value={hourMeter} onChange={setHourMeter} disabled={submitting} />
          <TextField label={t('csv.salesperson')} value={salesperson} onChange={setSalesperson} disabled={submitting} />
          <TextField label={t('csv.receivingPerson')} value={receivingPerson} onChange={setReceivingPerson} disabled={submitting} />
        </div>

        <h2 className="text-sm font-semibold text-gray-600">{t('pdf.gpsLocation')}</h2>
        <GpsLocationPicker value={gps} onChange={setGps} />

        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.attachmentsTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {(Object.keys(REQUIRED_PHOTO_FIELD) as RequiredPhotoSlot[]).map((slot) => (
            <div key={slot} className="rounded border border-dashed border-gray-300 p-3 text-center">
              <p className="mb-2 text-xs text-gray-500">{requiredPhotoLabels[slot]}</p>
              {photos[slot].url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos[slot].url as string} alt={requiredPhotoLabels[slot]} className="mb-2 h-24 w-full rounded object-cover" />
              ) : (
                <div className="mb-2 flex h-24 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">{t('ntr.noPhotoYet')}</div>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={submitting || uploadingSlot === slot}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadRequiredPhoto(slot, file, requiredPhotoLabels[slot]);
                }}
                className="w-full text-xs"
              />
              {uploadingSlot === slot && <p className="mt-1 text-xs text-gray-400">{t('ntr.uploading')}</p>}
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs text-gray-500">{t('pdf.videoLabel')} ({t('common.optional')})</p>
          <input
            type="file"
            accept="video/*"
            disabled={submitting || uploadingSlot === 'video'}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadVideo(file);
            }}
            className="w-full text-xs"
          />
          {videoUrl && <p className="mt-1 text-xs text-green-700">{t('ntr.videoUploaded')}</p>}
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

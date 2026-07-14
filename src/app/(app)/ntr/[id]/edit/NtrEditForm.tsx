'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import Card from '@/components/shared/layout/Card';
import TextField from '@/components/shared/forms/TextField';
import SelectField from '@/components/shared/forms/SelectField';
import AddressSelector, { type AddressValue } from '@/components/shared/scope/AddressSelector';
import { CUSTOMER_TYPE_VALUES, type CustomerType } from '@/shared/master-data/lookup/customerType';
import { CUSTOMER_TITLE_VALUES, CUSTOMER_TITLE_LABELS_TH } from '@/shared/master-data/lookup/customerTitle';
import type { NtrRecord } from '@/features/ntr/types';

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export default function NtrEditForm({ record }: { record: NtrRecord }) {
  const router = useRouter();
  const { t } = useTranslation();

  const [salesperson, setSalesperson] = useState(record.salesperson ?? '');
  const [customerTitle, setCustomerTitle] = useState(record.customer_title ?? '');
  const [customerFirstName, setCustomerFirstName] = useState(record.customer_first_name ?? '');
  const [customerLastName, setCustomerLastName] = useState(record.customer_last_name ?? '');
  const [customerName, setCustomerName] = useState(record.customer_name ?? '');
  const [customerPhone, setCustomerPhone] = useState(record.customer_phone ?? '');
  const [addressValue, setAddressValue] = useState<AddressValue>({
    address: record.customer_address ?? '',
    province: record.customer_province ?? '',
    district: record.customer_district ?? '',
    subdistrict: record.customer_subdistrict ?? '',
    postalCode: record.customer_postal_code ?? '',
  });
  const [customerType, setCustomerType] = useState<CustomerType | ''>(record.customer_type ?? '');
  const [deliveryDate, setDeliveryDate] = useState(record.delivery_date.slice(0, 10));
  const [hourMeter, setHourMeter] = useState(record.hour_meter != null ? String(record.hour_meter) : '');
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    const hasStructuredName = customerFirstName.trim() || customerLastName.trim();
    if (!customerName.trim() && !hasStructuredName) return t('validation.enterCustomerName');
    if (!/^0\d{9}$/.test(customerPhone.replace(/\D/g, ''))) return t('validation.invalidPhone');
    if (!deliveryDate) return t('validation.specifyDeliveryDate');
    return null;
  }

  async function onSave() {
    const validationError = validate();
    if (validationError) {
      await swalErrorToast(validationError);
      return;
    }
    const composedName = customerName.trim() || [customerTitle, customerFirstName, customerLastName].filter(Boolean).join(' ').trim();

    setSubmitting(true);
    swalLoading(t('common.saving'));
    try {
      await fetchJson(`/api/ntr-records/${encodeURIComponent(record.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
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
        }),
      });
      swalClose();
      swalSuccessToast(t('common.success'));
      router.push(`/ntr/${encodeURIComponent(record.id)}`);
      router.refresh();
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

  return (
    <Card variant="elevated" className="max-w-3xl space-y-4 p-5">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-600">{t('pdi.vehicleSectionTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t('common.serial')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{record.serial}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t('common.engineNumber')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{record.engine_number ?? '-'}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">{t('csv.model')}</label>
            <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{record.model ?? '-'}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
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

        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.deliveryInfoTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{`${t('csv.deliveryDate')} *`}</label>
            <input type="date" required className="w-full rounded border px-2 py-1.5 text-sm" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} disabled={submitting} />
          </div>
          <TextField label={t('pdf.hourMeter')} value={hourMeter} onChange={setHourMeter} disabled={submitting} />
          <TextField label={t('csv.salesperson')} value={salesperson} onChange={setSalesperson} disabled={submitting} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onSave} disabled={submitting} className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-50">
          {submitting ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </Card>
  );
}

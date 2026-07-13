'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';

export default function NewDeliveryForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const [serial, setSerial] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!serial.trim()) {
      swalError(t('delivery.serialRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetchJson<{ delivery: { id: string } }>('/api/delivery-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      });
      router.push(`/delivery/records/${res.delivery.id}`);
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Card variant="elevated" className="max-w-2xl space-y-4 p-5">
      <div>
        <label className="mb-1 block text-xs font-medium">{t('delivery.serialLabel')}</label>
        <input value={serial} onChange={(e) => setSerial(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={saving} className="btn-primary">
          {saving ? '...' : t('delivery.createAction')}
        </button>
        <button type="button" onClick={() => router.push('/delivery/records')} className="text-sm text-gray-500 hover:underline">
          {t('delivery.cancelAction')}
        </button>
      </div>
    </Card>
  );
}

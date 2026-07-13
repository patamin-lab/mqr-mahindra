'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';

export default function NewInspectionForm({ defaultTechnicianName }: { defaultTechnicianName: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [serial, setSerial] = useState('');
  const [technicianName, setTechnicianName] = useState(defaultTechnicianName);
  const [technicianCertificationRef, setTechnicianCertificationRef] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!serial.trim()) {
      swalError(t('pdi.serialRequired'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetchJson<{ inspection: { id: string } }>('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial, technicianName, technicianCertificationRef: technicianCertificationRef || null }),
      });
      router.push(`/delivery/pdi/${res.inspection.id}`);
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Card variant="elevated" className="max-w-2xl space-y-4 p-5">
      <div>
        <label className="mb-1 block text-xs font-medium">{t('pdi.serialLabel')}</label>
        <input value={serial} onChange={(e) => setSerial(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">{t('pdi.technicianLabel')}</label>
        <input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">{t('pdi.technicianCertificationLabel')}</label>
        <input value={technicianCertificationRef} onChange={(e) => setTechnicianCertificationRef(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={saving} className="btn-primary">
          {saving ? '...' : t('pdi.createAction')}
        </button>
        <button type="button" onClick={() => router.push('/delivery/pdi')} className="text-sm text-gray-500 hover:underline">
          {t('pdi.cancelAction')}
        </button>
      </div>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';

export default function NewKnowledgeCandidateForm({ productFamilies }: { productFamilies: { id: string; name: string }[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [symptom, setSymptom] = useState('');
  const [affectedSystem, setAffectedSystem] = useState('');
  const [productFamilyId, setProductFamilyId] = useState('');
  const [model, setModel] = useState('');
  const [possibleCauses, setPossibleCauses] = useState(['']);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!symptom.trim()) {
      swalError(t('knowledge.symptomLabel'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetchJson<{ case: { id: string } }>('/api/knowledge-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptom,
          affectedSystem: affectedSystem || null,
          productFamilyId: productFamilyId || null,
          model: model || null,
          possibleCauses: possibleCauses.filter((c) => c.trim()).map((cause) => ({ cause })),
        }),
      });
      router.push(`/quality/knowledge/${res.case.id}`);
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <Card variant="elevated" className="p-5 space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs font-medium mb-1">{t('knowledge.symptomLabel')}</label>
        <textarea value={symptom} onChange={(e) => setSymptom(e.target.value)} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">{t('knowledge.affectedSystemLabel')}</label>
        <input value={affectedSystem} onChange={(e) => setAffectedSystem(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">{t('knowledge.productFamilyLabel')}</label>
          <select value={productFamilyId} onChange={(e) => setProductFamilyId(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">-</option>
            {productFamilies.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">{t('knowledge.modelLabel')}</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">{t('knowledge.possibleCausesLabel')}</label>
        {possibleCauses.map((cause, i) => (
          <input
            key={i}
            value={cause}
            onChange={(e) => {
              const next = [...possibleCauses];
              next[i] = e.target.value;
              setPossibleCauses(next);
            }}
            className="mb-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        ))}
        <button type="button" onClick={() => setPossibleCauses([...possibleCauses, ''])} className="text-xs text-brand-red hover:underline">
          + {t('knowledge.possibleCausesLabel')}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={saving} className="btn-primary">
          {saving ? '...' : t('knowledge.createAction')}
        </button>
        <button type="button" onClick={() => router.push('/quality/knowledge')} className="text-sm text-gray-500 hover:underline">
          {t('knowledge.cancelAction')}
        </button>
      </div>
    </Card>
  );
}

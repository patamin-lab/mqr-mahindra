'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';

/** Inspection-level Factory Feedback - the overall narrative summary sent
 *  back to the factory/import side. Distinct from each finding's own
 *  structured disposition/status (`FindingsSection`). */
export default function FactoryFeedbackPanel({ inspectionId, factoryFeedback }: { inspectionId: string; factoryFeedback: string | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [value, setValue] = useState(factoryFeedback ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await fetchJson(`/api/inspections/${inspectionId}/factory-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: value }),
      });
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="flat" className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('pdi.factoryFeedbackTitle')}</h2>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder={t('pdi.factoryFeedbackPlaceholder')}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <button type="button" onClick={save} disabled={saving || !value.trim()} className="mt-2 rounded bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200">
        {saving ? '...' : t('pdi.saveFactoryFeedbackAction')}
      </button>
    </Card>
  );
}

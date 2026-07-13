'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';
import type { ChecklistItem } from '../types';

export default function ChecklistEditor({ inspectionId, checklist, canEdit }: { inspectionId: string; checklist: ChecklistItem[]; canEdit: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState(checklist);
  const [saving, setSaving] = useState(false);

  function setItem(id: string, patch: Partial<ChecklistItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function save() {
    setSaving(true);
    try {
      await fetchJson(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: items }),
      });
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const grouped = items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <Card variant="flat" className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('pdi.checklistTitle')}</h2>
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{category}</h3>
            <div className="space-y-2">
              {categoryItems.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-3 rounded border border-gray-100 p-2 text-sm">
                  <span className="min-w-[220px] flex-1">{item.label}</span>
                  <div className="flex gap-1">
                    {(['Pass', 'Fail', 'NA'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setItem(item.id, { result: r })}
                        className={`rounded px-2 py-1 text-xs ${
                          item.result === r ? (r === 'Pass' ? 'bg-green-600 text-white' : r === 'Fail' ? 'bg-red-600 text-white' : 'bg-gray-500 text-white') : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {t(`pdi.checklistResult${r}`)}
                      </button>
                    ))}
                  </div>
                  <input
                    disabled={!canEdit}
                    placeholder={t('pdi.remarkLabel')}
                    value={item.remark ?? ''}
                    onChange={(e) => setItem(item.id, { remark: e.target.value || null })}
                    className="w-48 rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {canEdit && (
        <button type="button" onClick={save} disabled={saving} className="btn-primary mt-4">
          {saving ? '...' : t('pdi.saveChecklistAction')}
        </button>
      )}
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';
import type { PartReplaced } from '../types';

export default function PartsReplacedSection({ inspectionId, partsReplaced, canEdit }: { inspectionId: string; partsReplaced: PartReplaced[]; canEdit: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [partName, setPartName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!partName.trim() || !reason.trim()) return;
    setSaving(true);
    try {
      await fetchJson(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partReplaced: { partName, partNumber: partNumber || null, qty: Number(qty) || 1, reason } }),
      });
      setPartName('');
      setPartNumber('');
      setQty('1');
      setReason('');
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="flat" className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('pdi.partsReplacedTitle')}</h2>
      {partsReplaced.length === 0 ? (
        <p className="mb-3 text-xs text-gray-400">{t('pdi.noPartsReason')}</p>
      ) : (
        <ul className="mb-4 space-y-1 text-sm">
          {partsReplaced.map((p) => (
            <li key={p.id} className="rounded border border-gray-100 p-2 text-xs">
              <span className="font-medium text-brand-dark">
                {p.partName} {p.partNumber ? `(${p.partNumber})` : ''} × {p.qty}
              </span>{' '}
              — {p.reason}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <input placeholder={t('pdi.partNameLabel')} value={partName} onChange={(e) => setPartName(e.target.value)} className="w-32 rounded border border-gray-300 px-2 py-1 text-xs" />
          <input placeholder={t('pdi.partNumberLabel')} value={partNumber} onChange={(e) => setPartNumber(e.target.value)} className="w-28 rounded border border-gray-300 px-2 py-1 text-xs" />
          <input placeholder={t('pdi.qtyLabel')} type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-16 rounded border border-gray-300 px-2 py-1 text-xs" />
          <input placeholder={t('pdi.reasonLabel')} value={reason} onChange={(e) => setReason(e.target.value)} className="w-48 rounded border border-gray-300 px-2 py-1 text-xs" />
          <button type="button" onClick={add} disabled={saving} className="rounded bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200">
            {saving ? '...' : t('pdi.addPartAction')}
          </button>
        </div>
      )}
    </Card>
  );
}

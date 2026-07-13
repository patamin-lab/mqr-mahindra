'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';
import type { Measurement } from '../types';

export default function MeasurementsSection({ inspectionId, measurements, canEdit }: { inspectionId: string; measurements: Measurement[]; canEdit: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [parameter, setParameter] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [specMin, setSpecMin] = useState('');
  const [specMax, setSpecMax] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!parameter.trim() || value === '') return;
    setSaving(true);
    try {
      await fetchJson(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurement: { parameter, value: Number(value), unit, specMin: specMin === '' ? null : Number(specMin), specMax: specMax === '' ? null : Number(specMax) },
        }),
      });
      setParameter('');
      setValue('');
      setUnit('');
      setSpecMin('');
      setSpecMax('');
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="flat" className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('pdi.measurementsTitle')}</h2>
      {measurements.length === 0 ? (
        <p className="mb-3 text-xs text-gray-400">{t('pdi.noMeasurementsReason')}</p>
      ) : (
        <table className="mb-4 w-full text-xs">
          <thead className="text-gray-500">
            <tr>
              <th className="px-2 py-1 text-left">{t('pdi.parameterLabel')}</th>
              <th className="px-2 py-1 text-left">{t('pdi.valueLabel')}</th>
              <th className="px-2 py-1 text-left">{t('pdi.specMinLabel')}</th>
              <th className="px-2 py-1 text-left">{t('pdi.specMaxLabel')}</th>
              <th className="px-2 py-1 text-left">{t('pdi.inRangeLabel')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {measurements.map((m) => (
              <tr key={m.id}>
                <td className="px-2 py-1">{m.parameter}</td>
                <td className="px-2 py-1">
                  {m.value} {m.unit}
                </td>
                <td className="px-2 py-1">{m.specMin ?? '-'}</td>
                <td className="px-2 py-1">{m.specMax ?? '-'}</td>
                <td className="px-2 py-1">{m.inRange === null ? '-' : m.inRange ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <input placeholder={t('pdi.parameterLabel')} value={parameter} onChange={(e) => setParameter(e.target.value)} className="w-32 rounded border border-gray-300 px-2 py-1 text-xs" />
          <input placeholder={t('pdi.valueLabel')} type="number" value={value} onChange={(e) => setValue(e.target.value)} className="w-20 rounded border border-gray-300 px-2 py-1 text-xs" />
          <input placeholder={t('pdi.unitLabel')} value={unit} onChange={(e) => setUnit(e.target.value)} className="w-16 rounded border border-gray-300 px-2 py-1 text-xs" />
          <input placeholder={t('pdi.specMinLabel')} type="number" value={specMin} onChange={(e) => setSpecMin(e.target.value)} className="w-20 rounded border border-gray-300 px-2 py-1 text-xs" />
          <input placeholder={t('pdi.specMaxLabel')} type="number" value={specMax} onChange={(e) => setSpecMax(e.target.value)} className="w-20 rounded border border-gray-300 px-2 py-1 text-xs" />
          <button type="button" onClick={add} disabled={saving} className="rounded bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200">
            {saving ? '...' : t('pdi.addMeasurementAction')}
          </button>
        </div>
      )}
    </Card>
  );
}

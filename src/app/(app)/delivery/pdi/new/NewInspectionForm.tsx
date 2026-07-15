'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
// Vehicle Master search-by-serial/engine-number reuses the existing NTR
// Tractor Search endpoint (`searchTractorsForNtr()` in `lib/db.ts`) rather
// than a second vehicle-search implementation - it already reads `vehicles`
// by serial/engine number and returns every master field this screen needs
// (Product Code/WH Arrival Date/Delivery Date included). `existing_ntr_number`
// is simply unused here.
import type { NtrTractorSearchResult } from '@/lib/db';

export default function NewInspectionForm({ defaultTechnicianName }: { defaultTechnicianName: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [searchSerial, setSearchSerial] = useState('');
  const [searchEngineNumber, setSearchEngineNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<NtrTractorSearchResult[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<NtrTractorSearchResult | null>(null);
  const [technicianName, setTechnicianName] = useState(defaultTechnicianName);
  const [saving, setSaving] = useState(false);

  async function runSearch() {
    if (!searchSerial.trim() && !searchEngineNumber.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (searchSerial.trim()) params.set('serial', searchSerial.trim());
      if (searchEngineNumber.trim()) params.set('engineNumber', searchEngineNumber.trim());
      const json = await fetchJson<{ ok: boolean; data: NtrTractorSearchResult[] }>(`/api/ntr/tractor-search?${params.toString()}`);
      setResults(json.data ?? []);
    } catch (err) {
      setResults([]);
      swalError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    if (!selectedVehicle) return;
    setSaving(true);
    try {
      const res = await fetchJson<{ inspection: { id: string } }>('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: selectedVehicle.serial, technicianName }),
      });
      router.push(`/delivery/pdi/${res.inspection.id}`);
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  if (selectedVehicle) {
    return (
      <Card variant="elevated" className="max-w-2xl space-y-4 p-5">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-600">{t('pdi.vehicleSectionTitle')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {([
              [t('common.serial'), selectedVehicle.serial],
              [t('common.engineNumber'), selectedVehicle.engine_number ?? '-'],
              [t('csv.productCode'), selectedVehicle.product_code ?? '-'],
              [t('csv.model'), selectedVehicle.model ?? '-'],
              [t('common.dealer'), selectedVehicle.dealer_name ?? selectedVehicle.dealer_id ?? '-'],
              [t('csv.whArrivalDate'), selectedVehicle.wh_arrival_date ?? '-'],
              [t('csv.deliveryDate'), selectedVehicle.delivery_date ?? '-'],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <label className="mb-1 block text-xs text-gray-500">{label}</label>
                <p className="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-700">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('pdi.technicianLabel')}</label>
          <input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={submit} disabled={saving} className="btn-primary">
            {saving ? '...' : t('pdi.createAction')}
          </button>
          <button type="button" onClick={() => setSelectedVehicle(null)} disabled={saving} className="text-sm text-gray-500 hover:underline">
            {t('ntr.backToSearch')}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="max-w-3xl space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">{t('csv.serial')}</label>
          <input value={searchSerial} onChange={(e) => setSearchSerial(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('common.engineNumber')}</label>
          <input value={searchEngineNumber} onChange={(e) => setSearchEngineNumber(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>
      <button type="button" onClick={runSearch} disabled={searching} className="btn-primary">
        {searching ? t('common.searching') : t('common.search')}
      </button>

      {searched && !searching && results.length === 0 && (
        <EmptyState title={t('common.notFound')} reason={t('ntr.noTractorFound')} nextStep={t('ntr.noTractorFoundNextStep')} />
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">{t('csv.serial')}</th>
                <th className="px-3 py-2">{t('common.engineNumber')}</th>
                <th className="px-3 py-2">{t('csv.productCode')}</th>
                <th className="px-3 py-2">{t('csv.model')}</th>
                <th className="px-3 py-2">{t('common.dealer')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {results.map((v) => (
                <tr key={v.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{v.serial}</td>
                  <td className="px-3 py-2">{v.engine_number ?? '-'}</td>
                  <td className="px-3 py-2">{v.product_code ?? '-'}</td>
                  <td className="px-3 py-2">{v.model ?? '-'}</td>
                  <td className="px-3 py-2">{v.dealer_name ?? v.dealer_id ?? '-'}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => setSelectedVehicle(v)} className="rounded bg-brand-red px-3 py-1.5 text-xs text-white hover:bg-brand-dark">
                      {t('common.select')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" onClick={() => router.push('/delivery/pdi')} className="text-sm text-gray-500 hover:underline">
        {t('pdi.cancelAction')}
      </button>
    </Card>
  );
}

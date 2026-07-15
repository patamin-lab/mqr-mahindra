'use client';

/**
 * Vehicle 360 entry point. Model-gated search over Vehicle Master
 * (`vehicles`) - a required Model selector narrows the pool first, then
 * one search field matches Serial Number/Engine Number/Product Code
 * (OR semantics) within that model only. Same `/api/vehicles/search`
 * route as before (now accepting an optional `model` param - see
 * `api/vehicles/search/route.ts`'s own comment), same result-click ->
 * Machine Passport navigation - no second search API, no second vehicle
 * repository.
 *
 * `basePath` defaults to `/machines` - Vehicle 360 (ADR-030) consolidated
 * onto the Machine Passport route/page rather than keeping a second,
 * near-duplicate `/vehicles/[serial]` implementation; `/vehicles` now just
 * redirects here.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson } from '@/lib/fetchJson';
import type { VehicleModelSearchResult } from '@/lib/db';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import EmptyState from '@/components/shared/layout/EmptyState';

export default function VehicleSearchBox({ basePath = '/machines' }: { basePath?: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<VehicleModelSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ ok: boolean; models: string[] }>('/api/vehicles/models')
      .then((json) => {
        if (!cancelled) setModels(json.models ?? []);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!selectedModel || q.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const json = await fetchJson<{ ok: boolean; results: VehicleModelSearchResult[] }>(
          `/api/vehicles/search?q=${encodeURIComponent(q.trim())}&model=${encodeURIComponent(selectedModel)}`
        );
        setResults(json.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
        setHasSearched(true);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, selectedModel]);

  function goTo(serial: string) {
    router.push(`${basePath}/${encodeURIComponent(serial)}`);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="max-w-xs">
        <label className="mb-1 block text-sm font-medium text-brand-dark">
          {t('common.model')} <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedModel}
          onChange={(e) => {
            setSelectedModel(e.target.value);
            setQ('');
            setResults([]);
            setHasSearched(false);
          }}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t('vehicle360.selectModelPlaceholder')}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-md">
        <label className="mb-1 block text-sm font-medium text-brand-dark">{t('vehicle360.searchBySerialLabel')}</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim() && results.length === 1) goTo(results[0].serial);
          }}
          disabled={!selectedModel}
          placeholder={selectedModel ? t('vehicle360.searchPlaceholder') : t('vehicle360.searchDisabledHint')}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
        />
        {searching && <p className="mt-1 text-xs text-gray-400">{t('common.searching')}</p>}
      </div>

      {results.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500">
              <tr>
                <th className="px-3 py-2">{t('vehicle360.searchBySerialLabel')}</th>
                <th className="px-3 py-2">{t('common.engineNumber')}</th>
                <th className="px-3 py-2">{t('common.productCode')}</th>
                <th className="px-3 py-2">{t('common.dealer')}</th>
                <th className="px-3 py-2">{t('common.deliveryDate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => (
                <tr key={r.id} onClick={() => goTo(r.serial)} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-brand-dark">{r.serial}</td>
                  <td className="px-3 py-2 text-gray-600">{r.engineNumber ?? 'N/A'}</td>
                  <td className="px-3 py-2 text-gray-600">{r.productCode ?? 'N/A'}</td>
                  <td className="px-3 py-2 text-gray-600">{r.dealerName ?? 'N/A'}</td>
                  <td className="px-3 py-2 text-gray-600">{r.deliveryDate ?? 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!searching && hasSearched && results.length === 0 && (
        <EmptyState
          icon="🔍"
          title={t('vehicle360.noResultsTitle')}
          reason={t('vehicle360.noResultsReason')}
          nextStep={t('vehicle360.noResultsNextStep')}
        />
      )}
    </div>
  );
}

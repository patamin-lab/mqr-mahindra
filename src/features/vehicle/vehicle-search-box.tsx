'use client';

/**
 * Vehicle 360 entry point via Serial Number search (spec's "Accessible from
 * Serial Number" bullet). Deliberately minimal - global cross-module search
 * (serial/engine/PM number/MQR number/customer/phone/dealer/branch) is
 * Phase 5c scope, not this page.
 *
 * `basePath` defaults to `/machines` - Vehicle 360 (ADR-030) consolidated
 * onto the Machine Passport route/page rather than keeping a second,
 * near-duplicate `/vehicles/[serial]` implementation; `/vehicles` now just
 * redirects here. Same `/api/vehicles/search` call, same debounce/result-
 * list behaviour either way - no second search implementation.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson } from '@/lib/fetchJson';
import type { VehicleSearchResult } from '@/lib/db';
import { useTranslation } from '@/lib/i18n/LocaleProvider';

export default function VehicleSearchBox({ basePath = '/machines' }: { basePath?: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<VehicleSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const json = await fetchJson<{ ok: boolean; results: VehicleSearchResult[] }>(
          `/api/vehicles/search?q=${encodeURIComponent(q.trim())}`
        );
        setResults(json.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  function goTo(serial: string) {
    router.push(`${basePath}/${encodeURIComponent(serial)}`);
  }

  return (
    <div className="max-w-md">
      <label className="mb-1 block text-sm font-medium text-brand-dark">{t('vehicle360.searchBySerialLabel')}</label>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) goTo(q.trim());
        }}
        placeholder={t('vehicle360.searchPlaceholder')}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      {searching && <p className="mt-1 text-xs text-gray-400">{t('common.searching')}</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 rounded border border-gray-200 bg-white shadow-sm">
          {results.map((r) => (
            <li key={r.serial}>
              <button
                type="button"
                onClick={() => goTo(r.serial)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-brand-dark">{r.serial}</span>
                <span className="text-xs text-gray-500">{r.model ?? 'N/A'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

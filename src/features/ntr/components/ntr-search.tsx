'use client';

/**
 * NTR search-first workflow: Search Tractor -> Existing Tractor or Create
 * Tractor -> `NtrForm` (Customer Information -> Delivery Information ->
 * Attachments -> Complete Registration). Mirrors `features/maintenance/
 * components/maintenance-search.tsx`'s search-step shape; the form step
 * itself is `../ntr-form.tsx` (One Form, Dual Mode - Production Pilot
 * readiness), shared with `/ntr/[id]/edit`, not a parallel implementation.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalErrorToast, swalLoading, swalClose } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import TextField from '@/components/shared/forms/TextField';
import EmptyState from '@/components/shared/layout/EmptyState';
import { useDealerBranchScope } from '@/components/shared/scope/useDealerBranchScope';
import DealerBranchSelector from '@/components/shared/scope/DealerBranchSelector';
import type { Dealer, Role } from '@/lib/types';
import type { NtrTractorSearchResult } from '@/lib/db';
import NtrForm from './ntr-form';

interface Props {
  dealers: Dealer[];
  role: Role;
  sessionDealerId: string | null;
  sessionBranchId: string | null;
  pinnedDealerName?: string | null;
  pinnedBranchName?: string | null;
}

export default function NtrSearch({ dealers, role, sessionDealerId, sessionBranchId, pinnedDealerName, pinnedBranchName }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'search' | 'form'>('search');

  const scope = useDealerBranchScope({
    role,
    sessionDealerId,
    sessionBranchId,
    initialDealers: dealers,
  });
  const dealerId = scope.currentDealer?.id ?? '';
  const branchId = scope.currentBranch?.id ?? '';
  const [serial, setSerial] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [model, setModel] = useState('');
  const [results, setResults] = useState<NtrTractorSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedTractor, setSelectedTractor] = useState<NtrTractorSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function showError(err: unknown) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalErrorToast(t('validation.sessionExpired'));
    } else {
      await swalErrorToast(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function runSearch() {
    setSearching(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (dealerId) params.set('dealerId', dealerId);
      if (branchId) params.set('branchId', branchId);
      if (serial.trim()) params.set('serial', serial.trim());
      if (engineNumber.trim()) params.set('engineNumber', engineNumber.trim());
      if (model.trim()) params.set('model', model.trim());
      const json = await fetchJson<{ ok: boolean; data: NtrTractorSearchResult[] }>(`/api/ntr/tractor-search?${params.toString()}`);
      setResults(json.data ?? []);
    } catch (err) {
      setResults([]);
      await showError(err);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (serial.trim().length < 3) return;
    debounceRef.current = setTimeout(() => {
      runSearch();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serial]);

  function selectTractor(tractor: NtrTractorSearchResult) {
    setSelectedTractor(tractor);
    setMode('form');
  }

  async function createTractorAndSelect() {
    if (!serial.trim()) {
      await swalErrorToast(t('validation.selectVehicle'));
      return;
    }
    swalLoading(t('common.saving'));
    try {
      const created = await fetchJson<{ ok: true; data: { id: string; serial: string; model: string | null; engine_number: string | null; dealer_id: string | null } }>(
        '/api/ntr/tractors',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            serial: serial.trim(),
            model: model.trim() || null,
            engine_number: engineNumber.trim() || null,
            branch_id: branchId || null,
            delivery_date: null,
            dealer_id: dealerId || undefined,
          }),
        }
      );
      swalClose();
      selectTractor({
        id: created.data.id,
        serial: created.data.serial,
        model: created.data.model,
        engine_number: created.data.engine_number,
        delivery_date: null,
        dealer_id: created.data.dealer_id,
        dealer_name: null,
        branch_id: branchId || null,
        branch_name: null,
        existing_ntr_number: null,
        // A freshly-created tractor has no Tractor IN sync data yet -
        // Product Family/Sub Model/Product Code/WH Arrival Date stay null
        // until the sheet has them and a sync runs (see TractorInSyncService).
        product_family_id: null,
        product_family_name: null,
        sub_model: null,
        product_code: null,
        wh_arrival_date: null,
      });
    } catch (err) {
      swalClose();
      await showError(err);
    }
  }

  if (mode === 'form' && selectedTractor) {
    return (
      <NtrForm
        mode="create"
        tractor={selectedTractor}
        onBack={() => {
          setMode('search');
          setSelectedTractor(null);
        }}
        onSaved={(record) => router.push(`/ntr/${encodeURIComponent(record.id)}`)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <h1 className="text-lg font-bold text-brand-dark">{t('ntr.searchTitle')}</h1>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <DealerBranchSelector
            scope={scope}
            pinnedDealerName={pinnedDealerName}
            pinnedBranchName={pinnedBranchName}
            dealerLabel={t('common.dealer')}
            branchLabel={t('common.branch')}
            dealerAllLabel={t('common.allDealers')}
            branchAllLabel={t('common.allBranches')}
            className="contents"
          />
          <TextField label={t('csv.serial')} value={serial} onChange={setSerial} placeholder={t('ntr.searchSerialPlaceholder')} />
          <TextField label={t('common.engineNumber')} value={engineNumber} onChange={setEngineNumber} />
          <TextField label={t('csv.model')} value={model} onChange={setModel} />
        </div>
        <div>
          <button type="button" onClick={runSearch} disabled={searching} className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-50">
            {searching ? t('common.searching') : t('common.search')}
          </button>
        </div>
      </div>

      {searched && !searching && results.length === 0 && (
        <EmptyState
          title={t('common.notFound')}
          reason={t('ntr.noTractorFound')}
          nextStep={t('ntr.noTractorFoundNextStep')}
          action={
            serial.trim() ? (
              <button type="button" onClick={createTractorAndSelect} className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark">
                {t('ntr.createTractorButton')}
              </button>
            ) : undefined
          }
        />
      )}

      {results.length > 0 && (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">{t('csv.serial')}</th>
                <th className="px-3 py-2">{t('csv.model')}</th>
                <th className="px-3 py-2">{t('common.dealer')}</th>
                <th className="px-3 py-2">{t('common.branch')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {results.map((v) => (
                <tr key={v.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold">{v.serial}</td>
                  <td className="px-3 py-2">{v.model ?? '-'}</td>
                  <td className="px-3 py-2">{v.dealer_name ?? v.dealer_id ?? '-'}</td>
                  <td className="px-3 py-2">{v.branch_name ?? '-'}</td>
                  <td className="px-3 py-2">
                    {v.existing_ntr_number ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                        {t('validation.tractorAlreadyRegistered', { ntrNumber: v.existing_ntr_number })}
                      </span>
                    ) : (
                      <button type="button" onClick={() => selectTractor(v)} className="rounded bg-brand-red px-3 py-1.5 text-xs text-white hover:bg-brand-dark">
                        {t('common.select')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

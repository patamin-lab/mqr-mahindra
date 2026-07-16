'use client';

/** Delivery Record detail - the one stage-appropriate action for the
 *  current stage. Button/form visibility here is UX only - every action
 *  is re-checked server-side by its own route (`SECURITY_STANDARD.md`:
 *  nav/button visibility is never the real gate), same pattern
 *  `InspectionActions.tsx` already uses. Each action calls the
 *  already-existing `DeliveryService` method through its new thin HTTP
 *  wrapper - no business logic lives here. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError, swalSuccessToast } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import type { DeliveryStage } from '../types';

interface InspectionOption {
  id: string;
  inspectionRef: string;
  status: string;
}

interface NtrOption {
  id: string;
  ntrNumber: string;
}

export default function DeliveryRecordActions({
  deliveryId,
  stage,
  canApprove,
  canLinkInspection,
  availableInspections,
  availableNtrRecords,
}: {
  deliveryId: string;
  stage: DeliveryStage;
  canApprove: boolean;
  canLinkInspection: boolean;
  availableInspections: InspectionOption[];
  availableNtrRecords: NtrOption[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState('');
  const [inspectionId, setInspectionId] = useState('');
  const [prepNotes, setPrepNotes] = useState('');
  const [ntrId, setNtrId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorPhone, setOperatorPhone] = useState('');
  const [trainerName, setTrainerName] = useState('');
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().slice(0, 10));
  const [trainingNotes, setTrainingNotes] = useState('');
  const [acceptanceNotes, setAcceptanceNotes] = useState('');

  async function post(path: string, body: Record<string, unknown>, successKey: string) {
    setBusy(true);
    try {
      await fetchJson(`/api/delivery-records/${deliveryId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      swalSuccessToast(t(successKey));
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (stage === 'TractorIn') {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.stockYardLocationLabel')}</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => post('receive-stock-yard', { location: location.trim() || null }, 'delivery.receiveStockYardSuccess')}
          className="rounded bg-brand-primary px-3 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          {busy ? '...' : t('delivery.receiveStockYardAction')}
        </button>
      </div>
    );
  }

  if (stage === 'StockYard' || stage === 'PDI') {
    if (!canLinkInspection) {
      return <p className="text-xs text-gray-400">{t('delivery.linkInspectionRequiresMseal')}</p>;
    }
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.selectInspectionLabel')}</label>
          <select value={inspectionId} onChange={(e) => setInspectionId(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">{t('delivery.selectInspectionPlaceholder')}</option>
            {availableInspections.map((i) => (
              <option key={i.id} value={i.id}>
                {i.inspectionRef} ({i.status})
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy || !inspectionId}
          onClick={() => post('link-inspection', { inspectionId }, 'delivery.linkInspectionSuccess')}
          className="rounded bg-brand-primary px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? '...' : t('delivery.linkInspectionAction')}
        </button>
      </div>
    );
  }

  if (stage === 'DealerPreparation') {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.dealerPrepNotesLabel')}</label>
          <input value={prepNotes} onChange={(e) => setPrepNotes(e.target.value)} className="w-64 rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => post('complete-dealer-prep', { notes: prepNotes.trim() || null }, 'delivery.completeDealerPrepSuccess')}
          className="rounded bg-brand-primary px-3 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          {busy ? '...' : t('delivery.completeDealerPrepAction')}
        </button>
      </div>
    );
  }

  if (stage === 'CustomerDelivery') {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.selectNtrLabel')}</label>
          <select value={ntrId} onChange={(e) => setNtrId(e.target.value)} className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">{t('delivery.selectNtrPlaceholder')}</option>
            {availableNtrRecords.map((n) => (
              <option key={n.id} value={n.id}>
                {n.ntrNumber}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy || !ntrId}
          onClick={() => post('link-ntr', { ntrId }, 'delivery.linkNtrSuccess')}
          className="rounded bg-brand-primary px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? '...' : t('delivery.linkNtrAction')}
        </button>
      </div>
    );
  }

  if (stage === 'OperatorTraining') {
    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium">{`${t('delivery.operatorNameLabel')} *`}</label>
          <input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.operatorPhoneLabel')}</label>
          <input value={operatorPhone} onChange={(e) => setOperatorPhone(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{`${t('delivery.trainerNameLabel')} *`}</label>
          <input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{`${t('delivery.trainingDateLabel')} *`}</label>
          <input type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="mb-1 block text-xs font-medium">{t('delivery.notesLabel')}</label>
          <input value={trainingNotes} onChange={(e) => setTrainingNotes(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <button
            type="button"
            disabled={busy || !operatorName.trim() || !trainerName.trim() || !trainingDate}
            onClick={() =>
              post(
                'training',
                {
                  operatorName: operatorName.trim(),
                  operatorPhone: operatorPhone.trim() || null,
                  trainerName: trainerName.trim(),
                  trainerId: null,
                  trainingTopics: [],
                  trainingDate,
                  trainingDurationMinutes: null,
                  customerSatisfactionScore: null,
                  notes: trainingNotes.trim() || null,
                },
                'delivery.recordTrainingSuccess'
              )
            }
            className="rounded bg-brand-primary px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? '...' : t('delivery.recordTrainingAction')}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'DeliveryAcceptance') {
    if (!canApprove) {
      return <p className="text-xs text-gray-400">{t('delivery.acceptanceRequiresApprover')}</p>;
    }
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.acceptanceNotesLabel')}</label>
          <input value={acceptanceNotes} onChange={(e) => setAcceptanceNotes(e.target.value)} className="w-64 rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => post('acceptance', { acceptanceNotes: acceptanceNotes.trim() || null }, 'delivery.recordAcceptanceSuccess')}
          className="rounded bg-brand-primary px-3 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          {busy ? '...' : t('delivery.recordAcceptanceAction')}
        </button>
      </div>
    );
  }

  if (stage === 'WarrantyActivation') {
    return <p className="text-xs text-gray-400">{t('delivery.warrantyActivationWaiting')}</p>;
  }

  return <p className="text-xs text-gray-400">{t('delivery.stageCompleted')}</p>;
}

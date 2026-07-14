'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError, swalSuccessToast } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import { canApproveDelivery, canAccessImportInspection } from '@/lib/scope';
import type { Role } from '@/lib/types';
import Card from '@/components/shared/layout/Card';
import type { DeliveryStage } from '../types';

interface AvailableInspection {
  id: string;
  inspectionRef: string;
  status: string;
}

/** One stage-dependent action form - the next real action available for
 *  this Delivery Record's current stage. Button/form visibility here is
 *  UX only; every action is re-checked server-side by its own route
 *  (`SECURITY_STANDARD.md`). */
export default function DeliveryActionsPanel({
  deliveryId,
  stage,
  role,
  availableInspections,
}: {
  deliveryId: string;
  stage: DeliveryStage;
  role: Role;
  availableInspections: AvailableInspection[];
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [stockYardLocation, setStockYardLocation] = useState('');
  const [inspectionId, setInspectionId] = useState(availableInspections[0]?.id ?? '');
  const [dealerPrepNotes, setDealerPrepNotes] = useState('');
  const [ntrId, setNtrId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorPhone, setOperatorPhone] = useState('');
  const [trainerName, setTrainerName] = useState('');
  const [trainingTopics, setTrainingTopics] = useState('');
  const [trainingDuration, setTrainingDuration] = useState('');
  const [satisfactionScore, setSatisfactionScore] = useState('');
  const [acceptanceNotes, setAcceptanceNotes] = useState('');

  async function call(path: string, body: unknown, successKey: string) {
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
      <Card variant="flat" className="space-y-3 p-5">
        <label className="block text-xs font-medium">{t('delivery.stockYardLocationLabel')}</label>
        <input value={stockYardLocation} onChange={(e) => setStockYardLocation(e.target.value)} className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm" />
        <button type="button" disabled={busy} onClick={() => call('stock-yard', { location: stockYardLocation || null }, 'delivery.stockYardAction')} className="btn-primary">
          {busy ? '...' : t('delivery.stockYardAction')}
        </button>
      </Card>
    );
  }

  if (stage === 'StockYard' || stage === 'PDI') {
    if (!canAccessImportInspection(role)) {
      return (
        <Card variant="flat" className="p-5 text-xs text-gray-500">
          {t('pdi.forbiddenReason')}
        </Card>
      );
    }
    return (
      <Card variant="flat" className="space-y-3 p-5">
        {availableInspections.length === 0 ? (
          <p className="text-xs text-gray-400">{t('pdi.emptyListReason')}</p>
        ) : (
          <>
            <label className="block text-xs font-medium">{t('delivery.inspectionRefLabel')}</label>
            <select value={inspectionId} onChange={(e) => setInspectionId(e.target.value)} className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm">
              {availableInspections.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.inspectionRef} ({i.status})
                </option>
              ))}
            </select>
            <button type="button" disabled={busy || !inspectionId} onClick={() => call('link-inspection', { inspectionId }, 'delivery.linkInspectionAction')} className="btn-primary">
              {busy ? '...' : t('delivery.linkInspectionAction')}
            </button>
          </>
        )}
      </Card>
    );
  }

  if (stage === 'DealerPreparation') {
    return (
      <Card variant="flat" className="space-y-3 p-5">
        <label className="block text-xs font-medium">{t('delivery.dealerPrepNotesLabel')}</label>
        <textarea value={dealerPrepNotes} onChange={(e) => setDealerPrepNotes(e.target.value)} rows={2} className="w-full max-w-md rounded border border-gray-300 px-3 py-2 text-sm" />
        <button type="button" disabled={busy} onClick={() => call('dealer-prep', { notes: dealerPrepNotes || null }, 'delivery.dealerPrepAction')} className="btn-primary">
          {busy ? '...' : t('delivery.dealerPrepAction')}
        </button>
      </Card>
    );
  }

  if (stage === 'CustomerDelivery') {
    return (
      <Card variant="flat" className="space-y-3 p-5">
        <label className="block text-xs font-medium">{t('delivery.ntrIdLabel')}</label>
        <input value={ntrId} onChange={(e) => setNtrId(e.target.value)} className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm" />
        <button type="button" disabled={busy || !ntrId.trim()} onClick={() => call('link-ntr', { ntrId }, 'delivery.linkNtrAction')} className="btn-primary">
          {busy ? '...' : t('delivery.linkNtrAction')}
        </button>
      </Card>
    );
  }

  if (stage === 'OperatorTraining') {
    return (
      <Card variant="flat" className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-brand-dark">{t('delivery.trainingTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium">{t('delivery.operatorNameLabel')}</label>
            <input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t('delivery.operatorPhoneLabel')}</label>
            <input value={operatorPhone} onChange={(e) => setOperatorPhone(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t('delivery.trainerNameLabel')}</label>
            <input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t('delivery.trainingTopicsLabel')}</label>
            <input value={trainingTopics} onChange={(e) => setTrainingTopics(e.target.value)} placeholder="Engine, PTO, Hydraulics" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t('delivery.trainingDurationLabel')}</label>
            <input type="number" value={trainingDuration} onChange={(e) => setTrainingDuration(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">{t('delivery.satisfactionScoreLabel')}</label>
            <input type="number" min={1} max={5} value={satisfactionScore} onChange={(e) => setSatisfactionScore(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <button
          type="button"
          disabled={busy || !operatorName.trim() || !trainerName.trim()}
          onClick={() =>
            call(
              'training',
              {
                operatorName,
                operatorPhone: operatorPhone || null,
                trainerName,
                trainingTopics: trainingTopics
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((topic) => ({ topic, covered: true })),
                trainingDurationMinutes: trainingDuration ? Number(trainingDuration) : null,
                customerSatisfactionScore: satisfactionScore ? Number(satisfactionScore) : null,
              },
              'delivery.recordTrainingAction'
            )
          }
          className="btn-primary"
        >
          {busy ? '...' : t('delivery.recordTrainingAction')}
        </button>
      </Card>
    );
  }

  if (stage === 'DeliveryAcceptance') {
    if (!canApproveDelivery(role)) {
      return (
        <Card variant="flat" className="p-5 text-xs text-gray-500">
          {t('delivery.acceptanceTitle')}
        </Card>
      );
    }
    return (
      <Card variant="flat" className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-brand-dark">{t('delivery.acceptanceTitle')}</h2>
        <label className="block text-xs font-medium">{t('delivery.acceptanceNotesLabel')}</label>
        <textarea value={acceptanceNotes} onChange={(e) => setAcceptanceNotes(e.target.value)} rows={2} className="w-full max-w-md rounded border border-gray-300 px-3 py-2 text-sm" />
        <button type="button" disabled={busy} onClick={() => call('acceptance', { acceptanceNotes: acceptanceNotes || null }, 'delivery.recordAcceptanceAction')} className="btn-primary">
          {busy ? '...' : t('delivery.recordAcceptanceAction')}
        </button>
      </Card>
    );
  }

  if (stage === 'WarrantyActivation') {
    /** Warranty is never activated manually (business-domain correction) -
     *  it activates automatically once an NTR record is created for this
     *  machine (`DeliveryService.activateWarrantyFromNtr`). Nothing to do
     *  here but wait. */
    return (
      <Card variant="flat" className="p-5 text-xs text-gray-500">
        {t('delivery.warrantyWaitingOnNtr')}
      </Card>
    );
  }

  return null;
}

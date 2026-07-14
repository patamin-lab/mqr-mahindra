'use client';

/** Complete / Digital Sign-off / Release to Dealer. Button visibility here
 *  is UX only - each action is re-checked server-side by its own route
 *  (`SECURITY_STANDARD.md`: nav/button visibility is never the real
 *  gate). Dealer Approval does not exist in the corrected Import
 *  Inspection domain model - MSEAL alone decides Release to Dealer. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError, swalSuccessToast } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import type { InspectionResult, InspectionStatus, ReleaseStatus } from '../types';

export default function InspectionActions({
  inspectionId,
  status,
  result,
  signedOffAt,
  releaseStatus,
  technicianName,
}: {
  inspectionId: string;
  status: InspectionStatus;
  result: InspectionResult | null;
  signedOffAt: string | null;
  releaseStatus: ReleaseStatus;
  technicianName: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function post(path: string, key: string) {
    setBusy(key);
    try {
      await fetchJson(`/api/inspections/${inspectionId}/${path}`, { method: 'POST' });
      swalSuccessToast(t(`pdi.${key}`));
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function startRePdi() {
    setBusy('rePdiAction');
    try {
      const res = await fetchJson<{ inspection: { id: string } }>(`/api/inspections/${inspectionId}/re-pdi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: releaseStatus === 'Expired' ? 'STORAGE_EXPIRED' : 'REPAIR_VERIFICATION', technicianName }),
      });
      router.push(`/delivery/pdi/${res.inspection.id}`);
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== 'Completed' && status !== 'Cancelled' && (
        <button type="button" disabled={busy !== null} onClick={() => post('complete', 'completeAction')} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
          {busy === 'completeAction' ? '...' : t('pdi.completeAction')}
        </button>
      )}
      {status === 'Completed' && !signedOffAt && (
        <button type="button" disabled={busy !== null} onClick={() => post('sign-off', 'signOffAction')} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
          {busy === 'signOffAction' ? '...' : t('pdi.signOffAction')}
        </button>
      )}
      {signedOffAt && result === 'Pass' && releaseStatus === 'Pending' && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => post('release-to-dealer', 'releaseToDealerAction')}
          className="rounded bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          {busy === 'releaseToDealerAction' ? '...' : t('pdi.releaseToDealerAction')}
        </button>
      )}
      {status === 'Completed' && releaseStatus !== 'ReleasedToDealer' && (
        <button type="button" disabled={busy !== null} onClick={startRePdi} className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
          {busy === 'rePdiAction' ? '...' : t('pdi.startRePdiAction')}
        </button>
      )}
    </div>
  );
}

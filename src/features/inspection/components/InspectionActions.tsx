'use client';

/** Complete / Digital Sign-off / Dealer Approval. Button visibility here
 *  is UX only - each action is re-checked server-side by its own route
 *  (`SECURITY_STANDARD.md`: nav/button visibility is never the real
 *  gate). */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError, swalSuccessToast } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import { canApproveDelivery } from '@/lib/scope';
import type { Role } from '@/lib/types';
import type { InspectionStatus } from '../types';

export default function InspectionActions({
  inspectionId,
  status,
  signedOffAt,
  dealerApprovedAt,
  role,
}: {
  inspectionId: string;
  status: InspectionStatus;
  signedOffAt: string | null;
  dealerApprovedAt: string | null;
  role: Role;
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
      {signedOffAt && !dealerApprovedAt && canApproveDelivery(role) && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => post('dealer-approve', 'dealerApproveAction')}
          className="rounded bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          {busy === 'dealerApproveAction' ? '...' : t('pdi.dealerApproveAction')}
        </button>
      )}
    </div>
  );
}

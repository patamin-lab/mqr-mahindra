'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';

export default function NtrDeleteButton({ id, ntrNumber }: { id: string; ntrNumber: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const confirmed = await swalConfirm(t('ntr.confirmDeleteBody', { ntrNumber }), {
      title: t('ntr.confirmDeleteTitle'),
      confirmText: t('common.delete'),
    });
    if (!confirmed) return;

    setBusy(true);
    swalLoading(t('common.deleting'));
    try {
      await fetchJson<{ ok: true; data: null }>(`/api/ntr-records/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      swalClose();
      swalSuccessToast(t('common.success'));
      router.push('/ntr');
      router.refresh();
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        swalErrorToast(t('validation.sessionExpired'));
      } else {
        swalErrorToast(err instanceof Error ? err.message : t('common.error'));
      }
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? t('common.deleting') : t('common.delete')}
    </button>
  );
}

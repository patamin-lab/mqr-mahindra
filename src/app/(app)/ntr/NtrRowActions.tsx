'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, FileDown, Trash2 } from 'lucide-react';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import ActionColumn, { ActionColumnAction } from '@/components/shared/table/ActionColumn';

/** NTR list row actions - reuses `ntr/[id]/delete-button.tsx`'s exact
 *  confirm/API/error-handling logic (never duplicated), relocated into
 *  the shared `ActionColumn` and refreshing the current list instead of
 *  navigating away. */
export default function NtrRowActions({ id, ntrNumber, allowDelete }: { id: string; ntrNumber: string; allowDelete: boolean }) {
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
      router.refresh();
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        swalErrorToast(t('validation.sessionExpired'));
      } else {
        swalErrorToast(err instanceof Error ? err.message : t('common.error'));
      }
    } finally {
      setBusy(false);
    }
  }

  const actions: ActionColumnAction[] = [
    { key: 'view', icon: Eye, label: t('common.view'), href: `/ntr/${encodeURIComponent(id)}`, variant: 'view' },
    { key: 'edit', icon: Pencil, label: t('common.edit'), href: `/ntr/${encodeURIComponent(id)}/edit`, variant: 'edit' },
    {
      key: 'export',
      icon: FileDown,
      label: t('common.exportPdf'),
      href: `/api/ntr-records/${encodeURIComponent(id)}/export`,
      variant: 'export',
      external: true,
    },
  ];
  if (allowDelete) {
    actions.push({ key: 'delete', icon: Trash2, label: t('common.delete'), variant: 'delete', onClick: onDelete, disabled: busy });
  }

  return <ActionColumn actions={actions} />;
}

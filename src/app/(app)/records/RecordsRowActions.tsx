'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, FileDown, Trash2 } from 'lucide-react';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalError, swalLoading, swalClose } from '@/lib/swal';
import ActionColumn, { ActionColumnAction } from '@/components/shared/table/ActionColumn';

/** Quality Report list row actions - reuses `records/[jobId]/delete-
 *  button.tsx`'s exact confirm/API/error-handling logic (never
 *  duplicated), just relocated into the shared `ActionColumn` and
 *  refreshing the current list instead of navigating away, since we're
 *  already on it. */
export default function RecordsRowActions({
  jobId,
  allowEdit,
  allowExport,
  allowDelete,
}: {
  jobId: string;
  allowEdit: boolean;
  allowExport: boolean;
  allowDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const confirmed = await swalConfirm(`ยืนยันการลบรายงาน ${jobId}? (รายการจะถูกซ่อน ไม่สามารถกู้คืนได้เองในระบบ)`, {
      title: 'ลบรายงาน',
      confirmText: 'ลบรายงาน',
    });
    if (!confirmed) return;
    setBusy(true);
    swalLoading('กำลังลบรายงาน...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string }>(`/api/records/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
      });
      if (!json.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      swalClose();
      router.refresh();
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      } else {
        await swalError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setBusy(false);
    }
  }

  const actions: ActionColumnAction[] = [
    { key: 'view', icon: Eye, label: 'ดูรายละเอียด', href: `/records/${encodeURIComponent(jobId)}`, variant: 'view' },
  ];
  if (allowEdit) {
    actions.push({ key: 'edit', icon: Pencil, label: 'แก้ไข', href: `/records/${encodeURIComponent(jobId)}/edit`, variant: 'edit' });
  }
  if (allowExport) {
    actions.push({
      key: 'export',
      icon: FileDown,
      label: 'ส่งออก PDF',
      href: `/api/records/${encodeURIComponent(jobId)}/export`,
      variant: 'export',
      external: true,
    });
  }
  if (allowDelete) {
    actions.push({ key: 'delete', icon: Trash2, label: 'ลบรายงาน', variant: 'delete', onClick: onDelete, disabled: busy });
  }

  return <ActionColumn actions={actions} />;
}

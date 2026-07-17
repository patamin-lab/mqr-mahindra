'use client';

import { useState } from 'react';
import { Eye, FileDown, Trash2 } from 'lucide-react';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalPrompt, swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import ActionColumn, { ActionColumnAction } from '@/components/shared/table/ActionColumn';
import { evaluateMaintenanceLock } from '../utils/maintenanceLock';
import type { MaintenanceRecord } from '../types';

/** PM History Center row actions - reuses `pm-records/[id]/delete-
 *  button.tsx`'s exact lock-aware confirm/API logic (never duplicated:
 *  same reason-prompt-when-locked flow, same endpoint), relocated into
 *  the shared `ActionColumn` and refreshing the current page of results
 *  (via `onDeleted`) instead of navigating away. */
export default function PmRowActions({
  record,
  allowDelete,
  canForceDelete,
  onDeleted,
}: {
  record: MaintenanceRecord;
  allowDelete: boolean;
  canForceDelete: boolean;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const lock = evaluateMaintenanceLock(record);
  const deleteDisabled = lock.locked && !canForceDelete;

  async function onDelete() {
    let reason: string | null = null;
    if (lock.locked) {
      reason = await swalPrompt('รายการนี้ถูกล็อกแล้ว กรุณาระบุเหตุผลในการลบ', { title: 'ลบ PM Record ที่ถูกล็อก' });
      if (!reason) return;
    } else {
      const confirmed = await swalConfirm(`ยืนยันการลบ PM Record ${record.id}? (รายการจะถูกซ่อน ไม่สามารถกู้คืนได้เองในระบบ)`, {
        title: 'ลบ PM Record',
        confirmText: 'ลบ',
      });
      if (!confirmed) return;
    }

    setBusy(true);
    swalLoading('กำลังลบ...');
    try {
      await fetchJson<{ ok: true; data: null }>(`/api/pm-records/${encodeURIComponent(record.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ reason }),
      });
      swalClose();
      swalSuccessToast('ลบข้อมูลสำเร็จ');
      onDeleted();
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        swalErrorToast('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      } else {
        swalErrorToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      }
    } finally {
      setBusy(false);
    }
  }

  const actions: ActionColumnAction[] = [
    { key: 'view', icon: Eye, label: 'ดูรายละเอียด', href: `/pm-records/${encodeURIComponent(record.id)}`, variant: 'view' },
    { key: 'export', icon: FileDown, label: 'ส่งออก PDF', href: `/api/pm-records/${encodeURIComponent(record.id)}/export`, variant: 'export', external: true },
  ];
  if (allowDelete) {
    actions.push({
      key: 'delete',
      icon: Trash2,
      label: deleteDisabled ? 'รายการนี้ถูกล็อกแล้ว เฉพาะ Super Admin เท่านั้นที่สามารถลบได้' : 'ลบ',
      variant: 'delete',
      onClick: onDelete,
      disabled: busy || deleteDisabled,
    });
  }

  return <ActionColumn actions={actions} />;
}

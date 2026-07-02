'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalPrompt, swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';

interface Props {
  id: string;
  /** Whether this record is currently calculation-locked (server-computed,
   *  via `evaluateMaintenanceLock()`). */
  locked: boolean;
  /** Whether the current actor is allowed to delete a locked record
   *  (SuperAdmin only, per spec) - a locked record hides this button
   *  entirely for every other role rather than showing a button that
   *  would just fail. */
  canForceDelete: boolean;
}

export default function MaintenanceDeleteButton({ id, locked, canForceDelete }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (locked && !canForceDelete) {
    return (
      <span
        title="รายการนี้ถูกล็อกแล้ว เฉพาะ Super Admin เท่านั้นที่สามารถลบได้"
        className="rounded border border-gray-200 px-4 py-2 text-sm text-gray-300"
      >
        ลบ
      </span>
    );
  }

  async function onDelete() {
    let reason: string | null = null;
    if (locked) {
      reason = await swalPrompt('รายการนี้ถูกล็อกแล้ว กรุณาระบุเหตุผลในการลบ', {
        title: 'ลบ PM Record ที่ถูกล็อก',
      });
      if (!reason) return; // cancelled, or swalPrompt's own required-field validator blocked it
    } else {
      const confirmed = await swalConfirm(
        `ยืนยันการลบ PM Record ${id}? (รายการจะถูกซ่อน ไม่สามารถกู้คืนได้เองในระบบ)`,
        { title: 'ลบ PM Record', confirmText: 'ลบ' }
      );
      if (!confirmed) return;
    }

    setBusy(true);
    swalLoading('กำลังลบ...');
    try {
      await fetchJson<{ ok: true; data: null }>(`/api/pm-records/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ reason }),
      });
      swalClose();
      swalSuccessToast('ลบข้อมูลสำเร็จ');
      router.push('/pm-records');
      router.refresh();
    } catch (err) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        swalErrorToast('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      } else {
        swalErrorToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
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
      {busy ? 'กำลังลบ...' : 'ลบ'}
    </button>
  );
}

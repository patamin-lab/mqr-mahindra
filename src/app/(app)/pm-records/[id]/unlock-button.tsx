'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';

/** Temporary override (default 24h) - only rendered for Central/SuperAdmin
 *  by the caller. Every unlock is written to the audit trail server-side. */
export default function MaintenanceUnlockButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onUnlock() {
    const confirmed = await swalConfirm('ปลดล็อกรายการนี้ชั่วคราวเป็นเวลา 24 ชั่วโมง เพื่อแก้ไขข้อมูลที่กระทบการคำนวณ?', {
      title: 'ปลดล็อกชั่วคราว',
      confirmText: 'ปลดล็อก',
    });
    if (!confirmed) return;

    setBusy(true);
    swalLoading('กำลังปลดล็อก...');
    try {
      await fetchJson<{ ok: true; data: unknown }>(`/api/pm-records/${encodeURIComponent(id)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ hours: 24 }),
      });
      swalClose();
      swalSuccessToast('ปลดล็อกชั่วคราวสำเร็จ (24 ชั่วโมง)');
      router.refresh();
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

  return (
    <button
      type="button"
      onClick={onUnlock}
      disabled={busy}
      className="rounded border border-amber-300 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
    >
      {busy ? 'กำลังปลดล็อก...' : 'ปลดล็อกชั่วคราว 24 ชม.'}
    </button>
  );
}

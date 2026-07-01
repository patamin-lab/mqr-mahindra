'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';

export default function PmRecordDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const confirmed = await swalConfirm(
      `ยืนยันการลบ PM Record ${id}? (รายการจะถูกซ่อน ไม่สามารถกู้คืนได้เองในระบบ)`,
      { title: 'ลบ PM Record', confirmText: 'ลบ' }
    );
    if (!confirmed) return;

    setBusy(true);
    swalLoading('กำลังลบ...');
    try {
      await fetchJson<{ ok: true; data: null }>(`/api/pm-records/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
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

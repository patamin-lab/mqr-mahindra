'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalError, swalLoading, swalClose } from '@/lib/swal';

export default function DeleteButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const confirmed = await swalConfirm(
      `ยืนยันการลบรายงาน ${jobId}? (รายการจะถูกซ่อน ไม่สามารถกู้คืนได้เองในระบบ)`,
      { title: 'ลบรายงาน', confirmText: 'ลบรายงาน' }
    );
    if (!confirmed) return;
    setBusy(true);
    swalLoading('กำลังลบรายงาน...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string }>(`/api/records/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
      });
      if (!json.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      swalClose();
      router.push('/records');
      router.refresh();
    } catch (err: any) {
      swalClose();
      if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
        await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      } else {
        await swalError(err?.message ?? 'เกิดข้อผิดพลาด');
      }
      setBusy(false);
    }
  }

  return (
    <button onClick={onDelete} disabled={busy} className="btn-outline-danger">
      {busy ? 'กำลังลบ...' : 'ลบรายงาน'}
    </button>
  );
}

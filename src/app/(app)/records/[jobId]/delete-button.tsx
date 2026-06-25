'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { swalConfirm, swalError } from '@/lib/swal';

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
    try {
      const res = await fetch(`/api/records/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      router.push('/records');
      router.refresh();
    } catch (err: any) {
      await swalError(err?.message ?? 'เกิดข้อผิดพลาด');
      setBusy(false);
    }
  }

  return (
    <button onClick={onDelete} disabled={busy} className="btn-outline-danger">
      {busy ? 'กำลังลบ...' : 'ลบรายงาน'}
    </button>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onDelete() {
    if (!confirm(`ยืนยันการลบรายงาน ${jobId}? (รายการจะถูกซ่อน ไม่สามารถกู้คืนได้เองในระบบ)`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/records/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'ลบไม่สำเร็จ');
      router.push('/records');
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'เกิดข้อผิดพลาด');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onDelete}
        disabled={busy}
        className="text-sm px-3 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? 'กำลังลบ...' : 'ลบรายงาน'}
      </button>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalLoading, swalClose, swalError } from '@/lib/swal';

export default function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const submittingRef = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    swalLoading('กำลังส่งคำขอ...');
    try {
      const json = await fetchJson<{ ok: boolean; message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      swalClose();
      setSent(json.message);
    } catch (err: any) {
      swalClose();
      const msg = err instanceof FetchJsonError ? err.message : err?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      swalError(msg);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{sent}</p>
        <Link href="/login" className="text-sm text-brand-red hover:underline">
          ← กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">ชื่อผู้ใช้หรืออีเมล</label>
        <input
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoFocus
          required
        />
      </div>
      <button disabled={submitting} className="btn-primary w-full">
        {submitting ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
      </button>
      <Link href="/login" className="block text-center text-sm text-gray-500 hover:underline">
        ← กลับไปหน้าเข้าสู่ระบบ
      </Link>
    </form>
  );
}

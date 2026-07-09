'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalLoading, swalClose, swalError, swalSuccess } from '@/lib/swal';

export default function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้ง</p>
        <Link href="/forgot-password" className="text-sm text-brand-red hover:underline">
          ← ขอลิงก์ใหม่
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (newPassword !== confirmPassword) {
      swalError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    swalLoading('กำลังบันทึก...');
    try {
      await fetchJson<{ ok: boolean }>('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      swalClose();
      await swalSuccess('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
      // After success: invalidate token (done server-side), redirect to
      // Login (spec section 3).
      router.push('/login');
    } catch (err: any) {
      swalClose();
      const msg = err instanceof FetchJsonError ? err.message : err?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      swalError(msg);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">รหัสผ่านใหม่</label>
        <input
          type="password"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
          required
        />
        <p className="text-xs text-gray-400 mt-1">อย่างน้อย 8 ตัวอักษร มีทั้งตัวอักษรและตัวเลข</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">ยืนยันรหัสผ่านใหม่</label>
        <input
          type="password"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <button disabled={submitting} className="btn-primary w-full">
        {submitting ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
      </button>
    </form>
  );
}

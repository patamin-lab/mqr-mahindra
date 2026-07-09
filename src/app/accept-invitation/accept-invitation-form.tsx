'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalLoading, swalClose, swalError, swalSuccess } from '@/lib/swal';

export default function AcceptInvitationForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">ลิงก์คำเชิญไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ</p>
        <Link href="/login" className="text-sm text-brand-red hover:underline">
          ← กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (newPassword !== confirmPassword) {
      swalError('รหัสผ่านและการยืนยันไม่ตรงกัน');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    swalLoading('กำลังเปิดใช้งานบัญชี...');
    try {
      await fetchJson<{ ok: boolean }>('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      swalClose();
      await swalSuccess('เปิดใช้งานบัญชีเรียบร้อยแล้ว กรุณาเข้าสู่ระบบ');
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
        <label className="block text-sm font-medium mb-1">ตั้งรหัสผ่าน</label>
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
        <label className="block text-sm font-medium mb-1">ยืนยันรหัสผ่าน</label>
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
        {submitting ? 'กำลังดำเนินการ...' : 'ตั้งรหัสผ่านและเปิดใช้งานบัญชี'}
      </button>
    </form>
  );
}

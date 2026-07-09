'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalLoading, swalClose, swalError, swalSuccess } from '@/lib/swal';

/**
 * Change Password (spec section 4), reused as-is by both the standalone
 * `/change-password` page (the First Login Password Change forced
 * redirect - section 7) and the Profile → Security page's voluntary
 * change. `redirectTo` is the only thing that differs between the two.
 */
export default function ChangePasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoutOtherDevices, setLogoutOtherDevices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

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
      await fetchJson<{ ok: boolean }>('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword, logoutOtherDevices }),
      });
      swalClose();
      await swalSuccess('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
      router.push(redirectTo);
      router.refresh();
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
    <form onSubmit={onSubmit} className="space-y-4 max-w-sm">
      <div>
        <label className="block text-sm font-medium mb-1">รหัสผ่านปัจจุบัน</label>
        <input
          type="password"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">รหัสผ่านใหม่</label>
        <input
          type="password"
          className="w-full border border-gray-300 rounded px-3 py-2"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
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
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={logoutOtherDevices}
          onChange={(e) => setLogoutOtherDevices(e.target.checked)}
        />
        ออกจากระบบอุปกรณ์อื่นทั้งหมด
      </label>
      <button disabled={submitting} className="btn-primary w-full">
        {submitting ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
      </button>
    </form>
  );
}

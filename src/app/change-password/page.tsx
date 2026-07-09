import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ChangePasswordForm from '@/components/shared/auth/ChangePasswordForm';

/**
 * Standalone (no app shell/sidebar) - reached either voluntarily or via
 * `middleware.ts`'s forced redirect while `forcePasswordChange` is true
 * (First Login Password Change, spec section 7). Not rendering the app
 * shell here reinforces "block access to the application until password
 * change succeeds" - there's nothing to navigate to from this page.
 */
export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark px-4">
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm p-8">
        <h1 className="text-xl font-bold text-brand-red mb-1">เปลี่ยนรหัสผ่าน</h1>
        <p className="text-sm text-gray-500 mb-6">
          {session.forcePasswordChange
            ? 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ'
            : 'ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ'}
        </p>
        <ChangePasswordForm redirectTo="/dashboard" />
      </div>
    </div>
  );
}

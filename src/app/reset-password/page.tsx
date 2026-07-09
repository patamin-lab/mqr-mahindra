import ResetPasswordForm from './reset-password-form';

/** Public (no session) - `/reset-password?token=...` (spec section 3).
 *  Reads `token` server-side (a plain searchParams prop, not a client
 *  hook) so this stays a thin Server Component wrapper like every other
 *  page in this app. */
export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark px-4">
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm p-8">
        <h1 className="text-xl font-bold text-brand-red mb-1">ตั้งรหัสผ่านใหม่</h1>
        <p className="text-sm text-gray-500 mb-6">ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p>
        <ResetPasswordForm token={searchParams.token ?? null} />
      </div>
    </div>
  );
}

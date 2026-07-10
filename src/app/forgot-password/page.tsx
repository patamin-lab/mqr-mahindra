import ForgotPasswordForm from './forgot-password-form';

/** Public (no session) - reachable straight from the Login page's
 *  "Forgot Password?" link (spec section 2). */
export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark px-4">
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm p-8">
        <h1 className="text-xl font-bold text-brand-red mb-1">ลืมรหัสผ่าน</h1>
        <p className="text-sm text-gray-500 mb-6">กรอกชื่อผู้ใช้หรืออีเมลของคุณ</p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}

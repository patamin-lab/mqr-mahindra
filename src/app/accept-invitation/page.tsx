import AcceptInvitationForm from './accept-invitation-form';

/** Public (no session) - `/accept-invitation?token=...` (spec section 8). */
export default function AcceptInvitationPage({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark px-4">
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm p-8">
        <h1 className="text-xl font-bold text-brand-red mb-1">ยินดีต้อนรับสู่ MQR</h1>
        <p className="text-sm text-gray-500 mb-6">ตั้งรหัสผ่านเพื่อเปิดใช้งานบัญชีของคุณ</p>
        <AcceptInvitationForm token={searchParams.token ?? null} />
      </div>
    </div>
  );
}

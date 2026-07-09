import { getSession } from '@/lib/auth';
import Card from '@/components/shared/layout/Card';
import ChangePasswordForm from '@/components/shared/auth/ChangePasswordForm';
import ActiveSessionsSection from '@/components/shared/auth/ActiveSessionsSection';

/** Profile -> Security -> Active Sessions (spec sections 4 and 5) - the
 *  voluntary counterpart to `/change-password`'s forced-flow entry point
 *  (both post to the same `/api/auth/change-password`, see
 *  `ChangePasswordForm`'s doc comment). */
export default async function SecurityPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-brand-dark">ความปลอดภัย</h1>

      <Card as="section" variant="flat" className="p-5">
        <h2 className="font-semibold text-brand-dark mb-3">เปลี่ยนรหัสผ่าน</h2>
        <ChangePasswordForm redirectTo="/profile/security" />
      </Card>

      <Card as="section" variant="flat" className="p-5">
        <h2 className="font-semibold text-brand-dark mb-3">เซสชันที่ใช้งานอยู่</h2>
        <ActiveSessionsSection />
      </Card>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canManageEmailHealth } from '@/lib/scope';
import { getEmailHealth } from '@/lib/authServices/emailHealthService';
import EmailHealthPanel from './email-health-panel';

export default async function EmailHealthAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canManageEmailHealth(session.role)) redirect('/dashboard');

  const health = await getEmailHealth();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">สถานะระบบอีเมล (Email Health)</h1>
      <EmailHealthPanel initialHealth={health} />
    </div>
  );
}

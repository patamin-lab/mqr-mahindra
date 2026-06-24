import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllDealersAdmin } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import DealersTable from './dealers-table';

export default async function DealersAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!seesAllDealers(session.role)) redirect('/dashboard');

  const dealers = await listAllDealersAdmin();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">จัดการดีลเลอร์</h1>
      <DealersTable initialDealers={dealers} />
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllUsersAdmin, listAllDealersAdmin } from '@/lib/db';
import { canManageUsers, seesAllDealers } from '@/lib/scope';
import UsersTable from './users-table';

export default async function UsersAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canManageUsers(session.role)) redirect('/dashboard');

  const users = await listAllUsersAdmin(seesAllDealers(session.role) ? null : session.dealerId);
  const dealers = seesAllDealers(session.role) ? await listAllDealersAdmin() : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">จัดการผู้ใช้งาน</h1>
      <UsersTable
        initialUsers={users}
        dealers={dealers}
        lockedDealerId={seesAllDealers(session.role) ? null : session.dealerId}
        actorRole={session.role}
        currentUsername={session.username}
      />
    </div>
  );
}

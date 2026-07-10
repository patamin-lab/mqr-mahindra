import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { listAllUsersAdmin, listAllDealersAdmin, getLatestEmailOutcomesForUsers } from '@/lib/db';
import { canManageUsers, seesAllDealers } from '@/lib/scope';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import UsersTable from './users-table';

export default async function UsersAdminPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canManageUsers(session.role)) redirect('/dashboard');

  const { dealerId, unrestricted } = resolveDealerScope(session, null);
  const users = await listAllUsersAdmin(dealerId);
  const dealers = seesAllDealers(session.role) ? await listAllDealersAdmin() : [];

  // User Email Completeness (Authentication Platform v3.0.1, Issue 5) -
  // computed, read-only fields; see `email-health` for the platform-wide
  // counterpart of this same question.
  const emailOutcomes = await getLatestEmailOutcomesForUsers(users.map((u) => u.id));
  const usersWithEmailStatus = users.map((u) => ({
    ...u,
    emailMissing: !u.email,
    forgotPasswordAvailable: !!u.email && u.active !== false,
    emailVerified: emailOutcomes.has(u.id) ? (emailOutcomes.get(u.id) as boolean) : null,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-dark">จัดการผู้ใช้งาน</h1>
      <UsersTable
        initialUsers={usersWithEmailStatus}
        dealers={dealers}
        lockedDealerId={unrestricted ? null : dealerId}
        actorRole={session.role}
        currentUsername={session.username}
      />
    </div>
  );
}

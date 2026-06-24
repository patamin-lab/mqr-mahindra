import { Role } from './types';

/** SuperAdmin (full system) and CentralAdmin (head-office, all dealers) see every dealer's records. */
export const seesAllDealers = (role: Role) => role === 'SuperAdmin' || role === 'CentralAdmin';

/** A Dealer User only sees the jobs they personally reported.
 *  (Branch-level "see my whole branch" viewing lands in Phase 3 once records carry a branch field.) */
export const seesOwnRecordsOnly = (role: Role) => role === 'DealerUser';

/** Who can manage parts stock (not built into the v1 UI, kept for parity). */
export const canManageParts = (role: Role) =>
  role === 'SuperAdmin' || role === 'CentralAdmin' || role === 'DealerAdmin';

/** Only a Dealer User cannot update job status / close jobs (they may still edit their own open record). */
export const canUpdateStatus = (role: Role) => role !== 'DealerUser';

/** Soft-delete: SuperAdmin (any case) and Dealer Admin (their own dealer's cases — enforced at the query level). */
export const canDelete = (role: Role) => role === 'SuperAdmin' || role === 'DealerAdmin';

/** Dealer User cannot export. Dealer Admin export is scoped to their own dealer at the query level. */
export const canExport = (role: Role) => role !== 'DealerUser';

/** Master-data / user management (Phase 2). */
export const canManageUsers = (role: Role) => role !== 'DealerUser';
export const canDeleteUsers = (role: Role) => role === 'SuperAdmin';
export const canCreateSuperAdmin = (role: Role) => role === 'SuperAdmin';
export const canManageMasterData = (role: Role) =>
  role === 'SuperAdmin' || role === 'CentralAdmin' || role === 'DealerAdmin';

export const roleLabelTh: Record<Role, string> = {
  SuperAdmin: 'ผู้ดูแลระบบสูงสุด',
  CentralAdmin: 'ผู้ดูแลส่วนกลาง',
  DealerAdmin: 'ผู้ดูแลดีลเลอร์',
  DealerUser: 'ผู้ใช้งานดีลเลอร์',
};

/** Which roles an actor is allowed to assign to a user they create/edit. */
export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === 'SuperAdmin') return ['SuperAdmin', 'CentralAdmin', 'DealerAdmin', 'DealerUser'];
  if (actorRole === 'CentralAdmin') return ['CentralAdmin', 'DealerAdmin', 'DealerUser'];
  if (actorRole === 'DealerAdmin') return ['DealerUser'];
  return [];
}

/** Whether `actorRole` may manage (edit/reset password/delete) a user currently holding `targetRole`. */
export function canManageRoleTarget(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === 'SuperAdmin') return true;
  if (actorRole === 'CentralAdmin') return targetRole !== 'SuperAdmin';
  if (actorRole === 'DealerAdmin') return targetRole === 'DealerUser';
  return false;
}

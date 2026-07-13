import { Role } from './types';

/** SuperAdmin (full system) and CentralAdmin (head-office, all dealers) see every dealer's records. */
export const seesAllDealers = (role: Role) => role === 'SuperAdmin' || role === 'CentralAdmin';

/** Who can manage parts stock (not built into the v1 UI, kept for parity). */
export const canManageParts = (role: Role) =>
  role === 'SuperAdmin' || role === 'CentralAdmin' || role === 'DealerAdmin';

/** Only a Dealer User cannot update job status / close jobs (they may still edit their own open record). */
export const canUpdateStatus = (role: Role) => role !== 'DealerUser';

/** Soft-delete: SuperAdmin (any case) and Dealer Admin (their own dealer's cases — enforced at the query level). */
export const canDelete = (role: Role) => role === 'SuperAdmin' || role === 'DealerAdmin';

/** Dealer User cannot export. Dealer Admin export is scoped to their own dealer at the query level. */
export const canExport = (role: Role) => role !== 'DealerUser';

/** Legacy Import (NTR) - Super Administrator only, per spec: "Dealer users,
 *  Dealer Admin, Technician must never see this feature." Enforced here
 *  (server-side route check) and by hiding the nav entry entirely for
 *  every other role - the same two-layer pattern every other permission
 *  boundary in this app uses. This is intentionally an application-layer
 *  control, not an RLS control - see docs/standards/SECURITY_STANDARD.md
 *  §Application-layer authorization for why. */
export const canManageLegacyImport = (role: Role) => role === 'SuperAdmin';

/** Master-data / user management (Phase 2). */
export const canManageUsers = (role: Role) => role !== 'DealerUser';
export const canDeleteUsers = (role: Role) => role === 'SuperAdmin';
export const canCreateSuperAdmin = (role: Role) => role === 'SuperAdmin';
export const canManageMasterData = (role: Role) =>
  role === 'SuperAdmin' || role === 'CentralAdmin' || role === 'DealerAdmin';

/** Authentication Platform v3.0 (spec section 13): "Only Admin or
 *  SuperAdmin" - the same DealerUser-excluded boundary every other
 *  admin-only action in this app already uses (`canManageUsers`). Kept as
 *  distinct, named predicates (not just reused `canManageUsers` calls
 *  inline) so each call site documents *which* admin action it's gating,
 *  matching this file's own "no inline role checks" convention. */
export const canInviteUsers = (role: Role) => role !== 'DealerUser';
export const canUnlockAccounts = (role: Role) => role !== 'DealerUser';
export const canForceResetPassword = (role: Role) => role !== 'DealerUser';
export const canForceLogoutAllSessions = (role: Role) => role !== 'DealerUser';

/** Authentication Platform v3.0.1 (Issue 3/4) - viewing Email Health and
 *  sending a test email. Unlike the per-user admin actions above, there
 *  is exactly one email provider configuration for the whole platform
 *  (no dealer scoping is possible), so this is restricted to the roles
 *  that already see cross-dealer/system-wide state (`seesAllDealers`),
 *  not every non-DealerUser role. */
export const canManageEmailHealth = (role: Role) => seesAllDealers(role);

/** Engineering Knowledge Platform (ADR-018) - "Engineering Review": only
 *  the roles that already see cross-dealer/system-wide state may move a
 *  Knowledge Case's maturity to Published, Deprecated, or Archived - the
 *  same boundary as `canManageEmailHealth`/PM Record unlock, not a new
 *  one. Creating a Knowledge Candidate and editing it while Draft/Review
 *  is open to every role (ch.07's "everyone who touches a Machine
 *  improves Knowledge") - only the trust-conferring transitions are
 *  gated here. */
export const canReviewKnowledge = (role: Role) => seesAllDealers(role);

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

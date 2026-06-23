import { Role } from './types';

/** SuperAdmin sees every dealer's records. */
export const seesAllDealers = (role: Role) => role === 'SuperAdmin';

/** A plain User only sees the jobs they personally reported. */
export const seesOwnRecordsOnly = (role: Role) => role === 'User';

/** Who can manage parts stock (not built into the v1 UI, kept for parity). */
export const canManageParts = (role: Role) =>
  role === 'SuperAdmin' || role === 'Admin' || role === 'SuperUser';

/** Only a plain User cannot update job status / close jobs. */
export const canUpdateStatus = (role: Role) => role !== 'User';

export const canDelete = (role: Role) => role === 'SuperAdmin';

export const roleLabelTh: Record<Role, string> = {
  SuperAdmin: 'ผู้ดูแลระบบสูงสุด',
  Admin: 'ผู้ดูแลดีลเลอร์',
  SuperUser: 'ผู้ใช้งานระดับสูง',
  User: 'ผู้ใช้งานทั่วไป',
};

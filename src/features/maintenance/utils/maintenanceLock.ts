/**
 * Maintenance Record calculation-protection lock (Production
 * Stabilization Sprint) — pure logic only, no Supabase access, so it's
 * trivially unit-testable and reusable by both the Service layer
 * (enforcement) and any UI that wants to show a lock badge without a
 * second round-trip.
 *
 * Business rule: a record becomes calculation-protected once it starts
 * affecting the vehicle's maintenance history — either a newer record
 * exists for the same vehicle ("superseded"), or its own 24-hour editable
 * window has passed ("edit_window_expired") — whichever happens first.
 * Central/SuperAdmin may temporarily unlock it (`unlocked_until`); once
 * that window itself expires, the record reads as locked again with
 * reason "manual_override" (it was intervened on, not merely aged out).
 */
import { MaintenanceLockReason, MaintenanceRecord } from '../types';

export const MAINTENANCE_EDITABLE_WINDOW_HOURS = 24;

/** Fields that feed the Due/Compliance/Health engines - once a record is
 *  locked, these become read-only regardless of role. Notes/attachments/
 *  remarks are never calculation-affecting and stay editable even on a
 *  locked record. */
export const MAINTENANCE_LOCK_AFFECTING_FIELDS = ['serial', 'performed_date', 'hour_meter', 'pm_interval_id'] as const;

export const MAINTENANCE_LOCK_REASON_LABEL: Record<MaintenanceLockReason, string> = {
  edit_window_expired: 'พ้นระยะเวลาที่แก้ไขได้ (24 ชั่วโมงหลังบันทึก)',
  superseded: 'มีการบันทึก PM ครั้งใหม่ของรถคันนี้แล้ว',
  administrative_lock: 'ล็อกโดยผู้ดูแลระบบ',
  manual_override: 'เคยถูกปลดล็อกชั่วคราวโดยผู้ดูแลระบบ (ครบกำหนดแล้ว)',
};

export interface MaintenanceLockStatus {
  locked: boolean;
  reason: MaintenanceLockReason | null;
}

export type MaintenanceLockFields = Pick<
  MaintenanceRecord,
  'created_at' | 'locked_at' | 'locked_reason' | 'unlocked_until'
>;

/** Evaluates whether a record is currently calculation-locked. Pure and
 *  deterministic given `now` - always pass a fixed `now` in tests. */
export function evaluateMaintenanceLock(record: MaintenanceLockFields, now: Date = new Date()): MaintenanceLockStatus {
  const unlockedUntil = record.unlocked_until ? new Date(record.unlocked_until) : null;
  if (unlockedUntil && unlockedUntil.getTime() > now.getTime()) {
    return { locked: false, reason: null };
  }
  const wasTemporarilyUnlocked = unlockedUntil !== null;

  if (record.locked_at) {
    return { locked: true, reason: wasTemporarilyUnlocked ? 'manual_override' : record.locked_reason };
  }

  const ageHours = (now.getTime() - new Date(record.created_at).getTime()) / (1000 * 60 * 60);
  if (ageHours > MAINTENANCE_EDITABLE_WINDOW_HOURS) {
    return { locked: true, reason: wasTemporarilyUnlocked ? 'manual_override' : 'edit_window_expired' };
  }

  return { locked: false, reason: null };
}

/** Whether `patch` touches any calculation-affecting field - the only
 *  thing a lock actually blocks. */
export function touchesLockAffectingFields(patch: Record<string, unknown>): boolean {
  return MAINTENANCE_LOCK_AFFECTING_FIELDS.some((field) => patch[field] !== undefined);
}

/**
 * Maintenance — service layer.
 *
 * Sits between routes and the repository. Rejects any actor with an empty
 * username before any mutation; all other request-scoping (dealer/branch
 * resolution) happens in the route handler before this layer is called.
 *
 * Also the sole enforcement point for the calculation-protection lock
 * (Production Stabilization Sprint) - `evaluateMaintenanceLock()` is a pure
 * function reusable by the UI for display, but only this layer's checks
 * are trusted to actually block a write. See `utils/maintenanceLock.ts`.
 */
import { logAuditEvent, logAuditEvents, diffFieldsForAudit } from '@/lib/db';
import { Role, SessionUser } from '@/lib/types';
import { translate } from '@/lib/i18n/translate';
import { Locale } from '@/lib/i18n/types';
import { MaintenanceRepository, MaintenanceFilter } from '../repositories/maintenanceRepository';
import {
  MaintenanceDuplicateCheckParams,
  MaintenanceHistoryFilter,
  MaintenanceHistoryResult,
  MaintenanceRecord,
  MaintenanceRecordCreateInput,
  MaintenanceRecordUpdateInput,
} from '../types';
import { evaluateMaintenanceLock, touchesLockAffectingFields } from '../utils/maintenanceLock';

export interface MaintenanceActor {
  username: string;
  role?: Role;
}

/** Thrown when `update()` is blocked by the calculation-protection lock -
 *  a distinct type (not just a plain `Error`) so callers (the API route)
 *  can detect a lock violation via `instanceof` rather than sniffing the
 *  error message's text, which would break once the message is
 *  localized and could read in either Thai or English. */
export class MaintenanceLockError extends Error {}

const UNLOCK_ROLES: Role[] = ['SuperAdmin', 'CentralAdmin'];
const DEFAULT_UNLOCK_HOURS = 24;

const PM_FIELD_LABELS: Record<string, string> = {
  serial: 'หมายเลขรถ',
  performed_date: 'วันที่ทำ PM',
  hour_meter: 'ชั่วโมงเครื่องยนต์',
  pm_interval_id: 'รอบ PM',
  technician_id: 'ช่างซ่อม',
  branch_id: 'สาขา',
  customer_name: 'ชื่อลูกค้า',
  customer_phone: 'เบอร์โทรลูกค้า',
  notes: 'หมายเหตุ',
};

export class MaintenanceService {
  constructor(private readonly repository: MaintenanceRepository) {}

  /** `session`, when passed, enforces the Dealer/Branch Scope Platform
   *  Standard via the repository's own `applyScope()`/`canAccessDealerBranch()` -
   *  forward it from every caller (routes, pages). */
  async list(filter?: MaintenanceFilter, session?: SessionUser): Promise<MaintenanceRecord[]> {
    return this.repository.list(filter, session);
  }

  async getById(id: string, session?: SessionUser): Promise<MaintenanceRecord | null> {
    return this.repository.getById(id, session);
  }

  async create(input: MaintenanceRecordCreateInput, actor: MaintenanceActor): Promise<MaintenanceRecord> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    const created = await this.repository.create(input, actor);

    await logAuditEvent({
      module: 'pm',
      recordId: created.id,
      recordRef: created.pm_number ?? created.id,
      eventType: 'Created',
      performedBy: actor.username,
    });

    // A vehicle without a known serial can't be matched for supersession -
    // leave it alone rather than guess.
    if (created.serial) {
      const lockedIds = await this.repository.lockSupersededRecordsForVehicle(created.serial, actor);
      if (lockedIds.length > 0) {
        await logAuditEvents(
          lockedIds.map((recordId) => ({
            module: 'pm' as const,
            recordId,
            recordRef: recordId,
            eventType: 'Locked' as const,
            newValue: 'superseded',
            performedBy: actor.username,
          }))
        );
      }
    }

    return created;
  }

  async update(
    id: string,
    input: MaintenanceRecordUpdateInput,
    actor: MaintenanceActor,
    locale: Locale = 'th'
  ): Promise<MaintenanceRecord> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new Error('Maintenance record not found');
    }

    if (touchesLockAffectingFields(input)) {
      const lock = evaluateMaintenanceLock(existing);
      if (lock.locked) {
        throw new MaintenanceLockError(
          translate(locale, 'validation.recordLocked', { reason: translate(locale, `lockReason.${lock.reason}`) })
        );
      }
    }

    const updated = await this.repository.update(id, input, actor);

    const events = diffFieldsForAudit(
      { module: 'pm', recordId: updated.id, recordRef: updated.pm_number ?? updated.id, performedBy: actor.username },
      PM_FIELD_LABELS,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    );
    await logAuditEvents(events);

    return updated;
  }

  /** Locked records may only be soft-deleted by SuperAdmin, with a
   *  mandatory reason - an unlocked record follows whatever delete
   *  permission the caller (route) already enforced, unchanged. */
  async delete(id: string, actor: MaintenanceActor, reason?: string | null, locale: Locale = 'th'): Promise<void> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new Error('Maintenance record not found');
    }

    const lock = evaluateMaintenanceLock(existing);
    if (lock.locked) {
      if (actor.role !== 'SuperAdmin') {
        throw new Error(translate(locale, 'validation.recordLockedDeleteSuperAdminOnly'));
      }
      if (!reason?.trim()) {
        throw new Error(translate(locale, 'validation.deleteReasonRequired'));
      }
    }

    await this.repository.delete(id, actor, reason);
    await logAuditEvent({
      module: 'pm',
      recordId: id,
      recordRef: existing.pm_number ?? id,
      eventType: 'Deleted',
      oldValue: reason ?? null,
      performedBy: actor.username,
    });
  }

  /** Explicit administrative lock - Central/SuperAdmin only. Locking an
   *  already-locked record is a harmless no-op write (idempotent from the
   *  caller's point of view, still logged). */
  async lock(id: string, actor: MaintenanceActor, locale: Locale = 'th'): Promise<MaintenanceRecord> {
    if (!actor.role || !UNLOCK_ROLES.includes(actor.role)) {
      throw new Error(translate(locale, 'validation.lockRequiresAdmin'));
    }
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new Error('Maintenance record not found');
    }
    const updated = await this.repository.lockRecord(id, 'administrative_lock', actor);
    await logAuditEvent({
      module: 'pm',
      recordId: id,
      recordRef: existing.pm_number ?? id,
      eventType: 'Locked',
      newValue: 'administrative_lock',
      performedBy: actor.username,
    });
    return updated;
  }

  /** Temporary override window (default 24h) - Central/SuperAdmin only.
   *  Every unlock/edit/relock is written to the audit trail per spec; the
   *  unlock event itself is logged here, the resulting edit(s) are logged
   *  by `update()` as normal `FieldChanged`/`RcaUpdated`-style events, and
   *  the record reads as locked again (reason `manual_override`) once
   *  `unlocked_until` passes - see `evaluateMaintenanceLock()`. */
  async unlock(
    id: string,
    actor: MaintenanceActor,
    hours: number = DEFAULT_UNLOCK_HOURS,
    locale: Locale = 'th'
  ): Promise<MaintenanceRecord> {
    if (!actor.role || !UNLOCK_ROLES.includes(actor.role)) {
      throw new Error(translate(locale, 'validation.unlockRequiresAdmin'));
    }
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new Error('Maintenance record not found');
    }
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const updated = await this.repository.unlockRecord(id, until, actor);
    await logAuditEvent({
      module: 'pm',
      recordId: id,
      recordRef: existing.pm_number ?? id,
      eventType: 'Unlocked',
      newValue: until,
      performedBy: actor.username,
    });
    return updated;
  }

  async findDuplicate(params: MaintenanceDuplicateCheckParams): Promise<MaintenanceRecord | null> {
    return this.repository.findDuplicate(params);
  }

  async listHistory(filter: MaintenanceHistoryFilter, session?: SessionUser): Promise<MaintenanceHistoryResult> {
    return this.repository.listHistory(filter, session);
  }
}

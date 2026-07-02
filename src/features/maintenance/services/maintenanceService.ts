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
import { Role } from '@/lib/types';
import { MaintenanceRepository, MaintenanceFilter } from '../repositories/maintenanceRepository';
import {
  MaintenanceDuplicateCheckParams,
  MaintenanceHistoryFilter,
  MaintenanceHistoryResult,
  MaintenanceRecord,
  MaintenanceRecordCreateInput,
  MaintenanceRecordUpdateInput,
} from '../types';
import { evaluateMaintenanceLock, touchesLockAffectingFields, MAINTENANCE_LOCK_REASON_LABEL } from '../utils/maintenanceLock';

export interface MaintenanceActor {
  username: string;
  role?: Role;
}

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

  async list(filter?: MaintenanceFilter): Promise<MaintenanceRecord[]> {
    return this.repository.list(filter);
  }

  async getById(id: string): Promise<MaintenanceRecord | null> {
    return this.repository.getById(id);
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

  async update(id: string, input: MaintenanceRecordUpdateInput, actor: MaintenanceActor): Promise<MaintenanceRecord> {
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
        throw new Error(
          `ไม่สามารถแก้ไขข้อมูลนี้ได้ เนื่องจากรายการถูกล็อก (${
            MAINTENANCE_LOCK_REASON_LABEL[lock.reason!]
          }) - เฉพาะฟิลด์ที่ไม่กระทบการคำนวณ (หมายเหตุ) เท่านั้นที่แก้ไขได้ กรุณาปลดล็อกชั่วคราวก่อนแก้ไขข้อมูลอื่น`
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
  async delete(id: string, actor: MaintenanceActor, reason?: string | null): Promise<void> {
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
        throw new Error('รายการนี้ถูกล็อกแล้ว เฉพาะ Super Admin เท่านั้นที่สามารถลบได้');
      }
      if (!reason?.trim()) {
        throw new Error('กรุณาระบุเหตุผลในการลบรายการที่ถูกล็อก');
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
  async lock(id: string, actor: MaintenanceActor): Promise<MaintenanceRecord> {
    if (!actor.role || !UNLOCK_ROLES.includes(actor.role)) {
      throw new Error('เฉพาะผู้ดูแลส่วนกลางขึ้นไปเท่านั้นที่สามารถล็อกรายการได้');
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
  async unlock(id: string, actor: MaintenanceActor, hours: number = DEFAULT_UNLOCK_HOURS): Promise<MaintenanceRecord> {
    if (!actor.role || !UNLOCK_ROLES.includes(actor.role)) {
      throw new Error('เฉพาะผู้ดูแลส่วนกลางขึ้นไปเท่านั้นที่สามารถปลดล็อกชั่วคราวได้');
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

  async listHistory(filter: MaintenanceHistoryFilter): Promise<MaintenanceHistoryResult> {
    return this.repository.listHistory(filter);
  }
}

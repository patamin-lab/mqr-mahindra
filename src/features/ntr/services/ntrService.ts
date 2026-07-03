/**
 * NTR — service layer.
 *
 * Sits between routes and the repository, mirroring
 * `src/features/maintenance/services/maintenanceService.ts`'s shape.
 * Sole enforcement point for "never create duplicate NTR" and the sole
 * place that writes to the shared Audit Platform (`record_audit_log`) and
 * publishes to the shared Timeline Platform (`VehicleEventPublisher`).
 */
import { logAuditEvent, logAuditEvents, diffFieldsForAudit } from '@/lib/db';
import { Role } from '@/lib/types';
import { NtrRepository } from '../repositories/ntrRepository';
import { NtrHistoryFilter, NtrHistoryResult, NtrRecord, NtrRecordCreateInput, NtrRecordUpdateInput } from '../types';
import { VehicleEventPublisher } from '@/features/vehicle-event/publisher';

export interface NtrActor {
  username: string;
  role?: Role;
}

const NTR_FIELD_LABELS: Record<string, string> = {
  branch_id: 'สาขา',
  salesperson: 'พนักงานขาย',
  receiving_person: 'ผู้รับมอบรถ',
  customer_name: 'ชื่อลูกค้า',
  customer_phone: 'เบอร์โทรลูกค้า',
  customer_address: 'ที่อยู่ลูกค้า',
  customer_district: 'อำเภอ/เขต',
  customer_province: 'จังหวัด',
  customer_postal_code: 'รหัสไปรษณีย์',
  customer_type: 'ประเภทลูกค้า',
  retail_date: 'วันที่ขายปลีก',
  delivery_date: 'วันที่ส่งมอบ',
  hour_meter: 'ชั่วโมงเครื่องยนต์',
  status: 'สถานะ',
};

export class NtrService {
  constructor(
    private readonly repository: NtrRepository,
    private readonly eventPublisher: VehicleEventPublisher
  ) {}

  async getById(id: string): Promise<NtrRecord | null> {
    return this.repository.getById(id);
  }

  async listHistory(filter: NtrHistoryFilter): Promise<NtrHistoryResult> {
    return this.repository.listHistory(filter);
  }

  /** Registers a tractor delivery. Enforces "never create duplicate NTR"
   *  independently of whatever the search-first UI already warned about -
   *  the service layer is the one that actually blocks it. Publishes both
   *  NTR_CREATED and NTR_COMPLETED (this module has no separate save-as-
   *  draft step - one create call is the full "Complete Registration"
   *  workflow action) and writes the Created audit event, in that order,
   *  so a failure partway through never leaves an audit/timeline entry for
   *  a record that doesn't exist. */
  async create(input: NtrRecordCreateInput, actor: NtrActor): Promise<NtrRecord> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    const existing = await this.repository.findActiveBySerial(input.serial);
    if (existing) {
      throw new Error(`Tractor serial "${input.serial}" is already registered (${existing.ntr_number})`);
    }

    const created = await this.repository.create(input, actor);

    await logAuditEvent({
      module: 'ntr',
      recordId: created.id,
      recordRef: created.ntr_number,
      eventType: 'Created',
      performedBy: actor.username,
    });

    await this.eventPublisher.publishNtrCreated({
      serial: created.serial,
      referenceId: created.ntr_number,
      eventDatetime: created.created_at,
      actor: { username: actor.username },
      customerName: created.customer_name,
    });
    await this.eventPublisher.publishNtrCompleted({
      serial: created.serial,
      referenceId: created.ntr_number,
      eventDatetime: created.created_at,
      actor: { username: actor.username },
      customerName: created.customer_name,
    });

    return created;
  }

  async update(id: string, input: NtrRecordUpdateInput, actor: NtrActor): Promise<NtrRecord> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new Error('NTR record not found');
    }

    const updated = await this.repository.update(id, input, actor);

    const events = diffFieldsForAudit(
      { module: 'ntr', recordId: updated.id, recordRef: updated.ntr_number, performedBy: actor.username },
      NTR_FIELD_LABELS,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    );
    await logAuditEvents(events);

    return updated;
  }

  async delete(id: string, actor: NtrActor, reason?: string | null): Promise<void> {
    if (!actor?.username?.trim()) {
      throw new Error('Actor username is required');
    }
    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new Error('NTR record not found');
    }

    await this.repository.delete(id, actor, reason);
    await logAuditEvent({
      module: 'ntr',
      recordId: id,
      recordRef: existing.ntr_number,
      eventType: 'Deleted',
      oldValue: reason ?? null,
      performedBy: actor.username,
    });
  }
}

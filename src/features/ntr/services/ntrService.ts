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
import { Role, SessionUser } from '@/lib/types';
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
  customer_title: 'คำนำหน้าชื่อลูกค้า',
  customer_first_name: 'ชื่อลูกค้า',
  customer_last_name: 'นามสกุลลูกค้า',
  customer_name: 'ชื่อลูกค้า',
  customer_phone: 'เบอร์โทรลูกค้า',
  customer_address: 'ที่อยู่ลูกค้า',
  customer_subdistrict: 'ตำบล/แขวง',
  customer_district: 'อำเภอ/เขต',
  customer_province: 'จังหวัด',
  customer_postal_code: 'รหัสไปรษณีย์',
  customer_type: 'ประเภทลูกค้า',
  product_family_id: 'กลุ่มผลิตภัณฑ์',
  variant: 'รุ่นย่อย',
  retail_date: 'วันที่ขายปลีก',
  delivery_date: 'วันที่ส่งมอบ',
  pdi_date: 'วันที่ตรวจสภาพก่อนส่งมอบ',
  pdi_number: 'เลขที่ใบตรวจสภาพก่อนส่งมอบ (PDI)',
  manufacturing_year: 'ปีที่ผลิต',
  hour_meter: 'ชั่วโมงเครื่องยนต์',
  status: 'สถานะ',
};

/** Composes `customer_name` from title/first/last when any of those are
 *  present, so a dealer capturing structured name fields never has to
 *  separately type a duplicate full name too - see
 *  docs/standards/DATABASE_STANDARD.md's "avoid storing duplicate
 *  business data" rule. `customer_name` stays the canonical, required,
 *  always-populated display field (unchanged for company customers or
 *  legacy-imported rows that only ever had a free-text name). */
function deriveCustomerName<T extends { customer_title?: string | null; customer_first_name?: string | null; customer_last_name?: string | null; customer_name?: string }>(
  input: T
): T {
  const hasStructuredName = input.customer_first_name || input.customer_last_name;
  if (!hasStructuredName) return input;
  const composed = [input.customer_title, input.customer_first_name, input.customer_last_name].filter(Boolean).join(' ').trim();
  if (!composed) return input;
  return { ...input, customer_name: composed };
}

export class NtrService {
  constructor(
    private readonly repository: NtrRepository,
    private readonly eventPublisher: VehicleEventPublisher
  ) {}

  /** `session`, when passed, enforces the Dealer/Branch Scope Platform
   *  Standard (a DealerUser can never fetch a record outside their own
   *  branch) - forward it from every caller (routes, pages); optional only
   *  for the few internal callers (e.g. `update()`/`delete()`'s own
   *  existence checks below) that already re-validate scope elsewhere. */
  async getById(id: string, session?: SessionUser): Promise<NtrRecord | null> {
    return this.repository.getById(id, session);
  }

  async listHistory(filter: NtrHistoryFilter, session?: SessionUser): Promise<NtrHistoryResult> {
    return this.repository.listHistory(filter, session);
  }

  /** Sub Model dropdown options for a Product Family (NTR Form Update,
   *  2026-07) - see `NtrRepository.listDistinctVariants()`'s doc comment. */
  async listDistinctVariants(productFamilyId: string): Promise<string[]> {
    return this.repository.listDistinctVariants(productFamilyId);
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

    const created = await this.repository.create(deriveCustomerName(input), actor);

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

    const updated = await this.repository.update(id, deriveCustomerName(input), actor);

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

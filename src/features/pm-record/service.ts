/**
 * PM Record — service layer.
 *
 * Sprint 11.2: Implements create() with validation, dealer isolation, snapshot
 * assembly, status initialisation, and audit field assignment.
 *
 * Sprint 11.3: Implements getById() with record existence check and dealer
 * isolation. SuperAdmin / CentralAdmin (dealerId === null) can see all records;
 * dealer-scoped users can only see records belonging to their own dealer.
 *
 * No SQL here — all persistence is delegated to the repository.
 */
import { PmRecordRepository, PmRecordFilter } from './repository';
import { PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

export interface PmRecordActor {
  username: string;
  dealerId: string | null;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Input shape for service.create(). The caller never supplies dealer_id or
 * status — those are enforced here from the session and business defaults.
 */
export type PmRecordServiceCreateInput = Omit<PmRecordCreateInput, 'dealer_id' | 'status'>;

export class PmRecordService {
  constructor(private readonly repository: PmRecordRepository) {}

  async list(filter?: PmRecordFilter) {
    return this.repository.list(filter);
  }

  /**
   * Fetch a single PM Record by ID, enforcing dealer isolation.
   *
   * - Returns the record if the caller owns it or is SuperAdmin/CentralAdmin.
   * - Throws NOT_FOUND if the record does not exist (no ID enumeration —
   *   FORBIDDEN is reserved for when the record exists but is out of scope).
   * - Throws FORBIDDEN if the record exists but belongs to a different dealer.
   */
  async getById(id: string, actor: PmRecordActor): Promise<PmRecord> {
    const record = await this.repository.getById(id);

    if (!record) {
      throw Object.assign(
        new Error('ไม่พบ PM Record ที่ระบุ'),
        { code: 'NOT_FOUND' },
      );
    }

    // Dealer isolation: null dealerId = SuperAdmin / CentralAdmin, sees all.
    // Non-null dealerId = DealerAdmin / DealerUser, scoped to own dealer only.
    if (actor.dealerId !== null && record.dealer_id !== actor.dealerId) {
      throw Object.assign(
        new Error('คุณไม่มีสิทธิ์เข้าถึง PM Record นี้'),
        { code: 'FORBIDDEN' },
      );
    }

    return record;
  }

  async create(raw: PmRecordServiceCreateInput, actor: PmRecordActor) {
    // 1. Dealer isolation — actor.dealerId is always the session value; the
    //    client body is never trusted to supply or override dealer_id.
    if (!isNonEmptyString(actor.dealerId)) {
      throw Object.assign(
        new Error('ผู้ใช้นี้ไม่ได้ผูกกับดีลเลอร์ ไม่สามารถสร้าง PM Record ได้'),
        { code: 'DEALER_REQUIRED' },
      );
    }

    // 2. Required field validation
    if (!isNonEmptyString(raw.scheduled_date)) {
      throw Object.assign(
        new Error('กรุณาระบุวันที่นัดหมาย PM'),
        { code: 'VALIDATION_ERROR' },
      );
    }

    // 3. Assemble the create input — snapshot fields trimmed, status forced to
    //    'scheduled', dealer_id always from actor (never from raw input).
    const input: PmRecordCreateInput = {
      dealer_id: actor.dealerId,
      branch_id: raw.branch_id ?? null,
      serial: raw.serial?.trim() || null,
      model: raw.model?.trim() || null,
      delivery_date: raw.delivery_date?.trim() || null,
      customer_name: raw.customer_name?.trim() || null,
      customer_phone: raw.customer_phone?.trim() || null,
      scheduled_date: raw.scheduled_date.trim(),
      status: 'scheduled',
      notes: raw.notes?.trim() || null,
    };

    return this.repository.create(input, { username: actor.username });
  }

  async update(id: string, input: PmRecordUpdateInput, actor: PmRecordActor) {
    return this.repository.update(id, input, { username: actor.username });
  }

  async delete(id: string, actor: PmRecordActor) {
    return this.repository.delete(id, { username: actor.username });
  }
}

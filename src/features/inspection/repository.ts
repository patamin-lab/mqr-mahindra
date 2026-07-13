/**
 * InspectionRepository — sole accessor of `inspections` (ADR-017). One
 * repository for one aggregate, matching `KnowledgeRepository`'s shape —
 * only `InspectionService` calls this class.
 */
import { getSupabase } from '@/lib/supabase';
import type {
  Inspection,
  InspectionListFilters,
  InspectionStatus,
  InspectionResult,
  InspectionType,
  ChecklistItem,
  Finding,
  Measurement,
  PartReplaced,
} from './types';

const TABLE = 'inspections';

function mapRow(row: any): Inspection {
  return {
    id: row.id,
    inspectionRef: row.inspection_ref,
    inspectionType: row.inspection_type as InspectionType,
    vehicleId: row.vehicle_id,
    serial: row.serial,
    dealerId: row.dealer_id,
    status: row.status as InspectionStatus,
    result: row.result as InspectionResult | null,
    checklistVersion: row.checklist_version,
    checklist: (row.checklist ?? []) as ChecklistItem[],
    findings: (row.findings ?? []) as Finding[],
    measurements: (row.measurements ?? []) as Measurement[],
    partsReplaced: (row.parts_replaced ?? []) as PartReplaced[],
    technicianId: row.technician_id,
    technicianName: row.technician_name,
    technicianCertificationRef: row.technician_certification_ref,
    signedOffBy: row.signed_off_by,
    signedOffAt: row.signed_off_at,
    dealerApprovedBy: row.dealer_approved_by,
    dealerApprovedAt: row.dealer_approved_at,
    relatedNtrId: row.related_ntr_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    recordStatus: row.record_status,
  };
}

export interface CreateInspectionInput {
  inspectionType: InspectionType;
  vehicleId: string;
  serial: string;
  dealerId: string | null;
  checklistVersion: string;
  checklist: ChecklistItem[];
  technicianId: string | null;
  technicianName: string;
  technicianCertificationRef: string | null;
  relatedNtrId: string | null;
  createdBy: string;
}

export interface UpdateInspectionInput {
  checklist?: ChecklistItem[];
  findings?: Finding[];
  measurements?: Measurement[];
  partsReplaced?: PartReplaced[];
  status?: InspectionStatus;
  result?: InspectionResult | null;
  signedOffBy?: string | null;
  signedOffAt?: string | null;
  dealerApprovedBy?: string | null;
  dealerApprovedAt?: string | null;
  updatedBy: string;
}

export class InspectionRepository {
  /** Lazy, not a field initializer — same reasoning as
   *  `KnowledgeRepository.client` (mockability + `getSupabase()`'s
   *  construction-time env check). */
  private get client() {
    return getSupabase();
  }

  /** `PDI-<year>-######`, dealer-scoped bucket (unlike Knowledge's global
   *  `'KNOW:GLOBAL'` bucket) — a PDI genuinely belongs to one dealer's
   *  operation, matching `DATABASE_STANDARD.md`'s default per-dealer
   *  `next_job_seq()` convention MQR/PM/NTR already use. */
  private async nextInspectionRef(dealerId: string | null): Promise<string> {
    const year = String(new Date().getFullYear());
    const { data, error } = await this.client.rpc('next_job_seq', {
      p_dealer_id: dealerId ?? 'PDI:UNASSIGNED',
      p_year: year,
    });
    if (error) throw error;
    const seq = Number(data);
    return `PDI-${year}-${String(seq).padStart(6, '0')}`;
  }

  async list(filters: InspectionListFilters = {}): Promise<Inspection[]> {
    let query = this.client.from(TABLE).select('*').eq('record_status', 'Active').order('created_at', { ascending: false });
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.dealerId) query = query.eq('dealer_id', filters.dealerId);
    if (filters.serial) query = query.eq('serial', filters.serial);
    if (filters.q) query = query.or(`inspection_ref.ilike.%${filters.q}%,serial.ilike.%${filters.q}%,technician_name.ilike.%${filters.q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapRow);
  }

  async getById(id: string): Promise<Inspection | null> {
    const { data, error } = await this.client.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data || data.record_status === 'Deleted') return null;
    return mapRow(data);
  }

  async listForSerial(serial: string): Promise<Inspection[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select('*')
      .eq('serial', serial)
      .eq('record_status', 'Active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapRow);
  }

  async create(input: CreateInspectionInput): Promise<Inspection> {
    const inspectionRef = await this.nextInspectionRef(input.dealerId);
    const { data, error } = await this.client
      .from(TABLE)
      .insert({
        inspection_ref: inspectionRef,
        inspection_type: input.inspectionType,
        vehicle_id: input.vehicleId,
        serial: input.serial,
        dealer_id: input.dealerId,
        checklist_version: input.checklistVersion,
        checklist: input.checklist,
        technician_id: input.technicianId,
        technician_name: input.technicianName,
        technician_certification_ref: input.technicianCertificationRef,
        related_ntr_id: input.relatedNtrId,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapRow(data);
  }

  async update(id: string, input: UpdateInspectionInput): Promise<Inspection> {
    const patch: Record<string, unknown> = { updated_by: input.updatedBy, updated_at: new Date().toISOString() };
    if (input.checklist !== undefined) patch.checklist = input.checklist;
    if (input.findings !== undefined) patch.findings = input.findings;
    if (input.measurements !== undefined) patch.measurements = input.measurements;
    if (input.partsReplaced !== undefined) patch.parts_replaced = input.partsReplaced;
    if (input.status !== undefined) patch.status = input.status;
    if (input.result !== undefined) patch.result = input.result;
    if (input.signedOffBy !== undefined) patch.signed_off_by = input.signedOffBy;
    if (input.signedOffAt !== undefined) patch.signed_off_at = input.signedOffAt;
    if (input.dealerApprovedBy !== undefined) patch.dealer_approved_by = input.dealerApprovedBy;
    if (input.dealerApprovedAt !== undefined) patch.dealer_approved_at = input.dealerApprovedAt;

    const { data, error } = await this.client.from(TABLE).update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return mapRow(data);
  }
}

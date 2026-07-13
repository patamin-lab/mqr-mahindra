/**
 * DeliveryRepository — owns `delivery_records` and `delivery_trainings`
 * (ADR-027). One repository for one aggregate (a delivery and its
 * training), matching `KnowledgeRepository`'s case+evidence shape — only
 * `DeliveryService` calls this class. Reads (never writes) `vehicles`
 * for one display-only field (`model`) via a read-only embedded select;
 * never queries or embeds `inspections`/`ntr_records` directly — those
 * are Inspection's (ADR-017) and NTR's own tables, read only through
 * their own services (`InspectionService`/`NtrService`), never through
 * this repository.
 */
import { getSupabase } from '@/lib/supabase';
import type {
  DeliveryRecord,
  DeliveryTraining,
  DeliveryListFilters,
  DeliveryStage,
  DeliveryOverallStatus,
  WarrantyActivationSource,
  TrainingTopic,
  DeliveryReportRow,
} from './types';

const RECORDS_TABLE = 'delivery_records';
const TRAININGS_TABLE = 'delivery_trainings';

function mapRecordRow(row: any): DeliveryRecord {
  return {
    id: row.id,
    deliveryRef: row.delivery_ref,
    vehicleId: row.vehicle_id,
    serial: row.serial,
    dealerId: row.dealer_id,
    stage: row.stage as DeliveryStage,
    stockYardReceivedAt: row.stock_yard_received_at,
    stockYardLocation: row.stock_yard_location,
    pdiInspectionId: row.pdi_inspection_id,
    dealerPreparationCompletedAt: row.dealer_preparation_completed_at,
    dealerPreparationNotes: row.dealer_preparation_notes,
    ntrId: row.ntr_id,
    trainingId: row.training_id,
    acceptanceSignedAt: row.acceptance_signed_at,
    acceptanceSignedBy: row.acceptance_signed_by,
    acceptanceNotes: row.acceptance_notes,
    warrantyActivatedAt: row.warranty_activated_at,
    warrantyActivationSource: row.warranty_activation_source as WarrantyActivationSource | null,
    overallStatus: row.overall_status as DeliveryOverallStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    recordStatus: row.record_status,
  };
}

function mapTrainingRow(row: any): DeliveryTraining {
  return {
    id: row.id,
    deliveryRecordId: row.delivery_record_id,
    serial: row.serial,
    operatorName: row.operator_name,
    operatorPhone: row.operator_phone,
    trainerName: row.trainer_name,
    trainerId: row.trainer_id,
    trainingTopics: (row.training_topics ?? []) as TrainingTopic[],
    trainingDate: row.training_date,
    trainingDurationMinutes: row.training_duration_minutes,
    customerSatisfactionScore: row.customer_satisfaction_score,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    recordStatus: row.record_status,
  };
}

export interface CreateDeliveryRecordInput {
  vehicleId: string;
  serial: string;
  dealerId: string | null;
  createdBy: string;
}

export interface UpdateDeliveryRecordInput {
  stage?: DeliveryStage;
  stockYardReceivedAt?: string | null;
  stockYardLocation?: string | null;
  pdiInspectionId?: string | null;
  dealerPreparationCompletedAt?: string | null;
  dealerPreparationNotes?: string | null;
  ntrId?: string | null;
  trainingId?: string | null;
  acceptanceSignedAt?: string | null;
  acceptanceSignedBy?: string | null;
  acceptanceNotes?: string | null;
  warrantyActivatedAt?: string | null;
  warrantyActivationSource?: WarrantyActivationSource | null;
  overallStatus?: DeliveryOverallStatus;
  updatedBy: string;
}

export interface CreateDeliveryTrainingInput {
  deliveryRecordId: string;
  serial: string;
  operatorName: string;
  operatorPhone: string | null;
  trainerName: string;
  trainerId: string | null;
  trainingTopics: TrainingTopic[];
  trainingDate: string;
  trainingDurationMinutes: number | null;
  customerSatisfactionScore: number | null;
  notes: string | null;
  createdBy: string;
}

export class DeliveryRepository {
  private get client() {
    return getSupabase();
  }

  /** `DEL-<year>-######`, dealer-scoped bucket - a delivery genuinely
   *  belongs to one dealer's operation, same convention as
   *  `InspectionRepository.nextInspectionRef()`. */
  private async nextDeliveryRef(dealerId: string | null): Promise<string> {
    const year = String(new Date().getFullYear());
    const { data, error } = await this.client.rpc('next_job_seq', {
      p_dealer_id: dealerId ?? 'DEL:UNASSIGNED',
      p_year: year,
    });
    if (error) throw error;
    const seq = Number(data);
    return `DEL-${year}-${String(seq).padStart(6, '0')}`;
  }

  async list(filters: DeliveryListFilters = {}): Promise<DeliveryRecord[]> {
    let query = this.client.from(RECORDS_TABLE).select('*').eq('record_status', 'Active').order('created_at', { ascending: false });
    if (filters.stage) query = query.eq('stage', filters.stage);
    if (filters.dealerId) query = query.eq('dealer_id', filters.dealerId);
    if (filters.serial) query = query.eq('serial', filters.serial);
    if (filters.q) query = query.or(`delivery_ref.ilike.%${filters.q}%,serial.ilike.%${filters.q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapRecordRow);
  }

  async getById(id: string): Promise<DeliveryRecord | null> {
    const { data, error } = await this.client.from(RECORDS_TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data || data.record_status === 'Deleted') return null;
    return mapRecordRow(data);
  }

  /** Machine Passport's Delivery section - the most recent delivery for
   *  this serial (a machine typically has exactly one, but this tolerates
   *  a re-delivery/returned-unit edge case without a schema constraint). */
  async getMostRecentForSerial(serial: string): Promise<DeliveryRecord | null> {
    const { data, error } = await this.client
      .from(RECORDS_TABLE)
      .select('*')
      .eq('serial', serial)
      .eq('record_status', 'Active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return mapRecordRow(data);
  }

  async create(input: CreateDeliveryRecordInput): Promise<DeliveryRecord> {
    const deliveryRef = await this.nextDeliveryRef(input.dealerId);
    const { data, error } = await this.client
      .from(RECORDS_TABLE)
      .insert({
        delivery_ref: deliveryRef,
        vehicle_id: input.vehicleId,
        serial: input.serial,
        dealer_id: input.dealerId,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapRecordRow(data);
  }

  async update(id: string, input: UpdateDeliveryRecordInput): Promise<DeliveryRecord> {
    const patch: Record<string, unknown> = { updated_by: input.updatedBy, updated_at: new Date().toISOString() };
    if (input.stage !== undefined) patch.stage = input.stage;
    if (input.stockYardReceivedAt !== undefined) patch.stock_yard_received_at = input.stockYardReceivedAt;
    if (input.stockYardLocation !== undefined) patch.stock_yard_location = input.stockYardLocation;
    if (input.pdiInspectionId !== undefined) patch.pdi_inspection_id = input.pdiInspectionId;
    if (input.dealerPreparationCompletedAt !== undefined) patch.dealer_preparation_completed_at = input.dealerPreparationCompletedAt;
    if (input.dealerPreparationNotes !== undefined) patch.dealer_preparation_notes = input.dealerPreparationNotes;
    if (input.ntrId !== undefined) patch.ntr_id = input.ntrId;
    if (input.trainingId !== undefined) patch.training_id = input.trainingId;
    if (input.acceptanceSignedAt !== undefined) patch.acceptance_signed_at = input.acceptanceSignedAt;
    if (input.acceptanceSignedBy !== undefined) patch.acceptance_signed_by = input.acceptanceSignedBy;
    if (input.acceptanceNotes !== undefined) patch.acceptance_notes = input.acceptanceNotes;
    if (input.warrantyActivatedAt !== undefined) patch.warranty_activated_at = input.warrantyActivatedAt;
    if (input.warrantyActivationSource !== undefined) patch.warranty_activation_source = input.warrantyActivationSource;
    if (input.overallStatus !== undefined) patch.overall_status = input.overallStatus;

    const { data, error } = await this.client.from(RECORDS_TABLE).update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return mapRecordRow(data);
  }

  async createTraining(input: CreateDeliveryTrainingInput): Promise<DeliveryTraining> {
    const { data, error } = await this.client
      .from(TRAININGS_TABLE)
      .insert({
        delivery_record_id: input.deliveryRecordId,
        serial: input.serial,
        operator_name: input.operatorName,
        operator_phone: input.operatorPhone,
        trainer_name: input.trainerName,
        trainer_id: input.trainerId,
        training_topics: input.trainingTopics,
        training_date: input.trainingDate,
        training_duration_minutes: input.trainingDurationMinutes,
        customer_satisfaction_score: input.customerSatisfactionScore,
        notes: input.notes,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapTrainingRow(data);
  }

  async getTrainingById(id: string): Promise<DeliveryTraining | null> {
    const { data, error } = await this.client.from(TRAININGS_TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data || data.record_status === 'Deleted') return null;
    return mapTrainingRow(data);
  }

  /** Dashboard/Report data source - a read-only embedded select against
   *  `vehicles` only (Machine's own identity field, `model`, read for
   *  display - the same lightweight denormalized-read convention
   *  Knowledge's own evidence rows use for `machineSerial`). Deliberately
   *  does NOT embed `inspections` - Delivery orchestrates PDI, it does
   *  not reach into PDI's own table for its fields (ADR-017/ADR-027's
   *  ownership boundary). `DeliveryService` composes Inspection data
   *  itself, via `InspectionService.listInspectionsByIds()`, using the
   *  `pdiInspectionId` this method already returns. */
  async listActiveWithRelated(filters: DeliveryListFilters = {}): Promise<(DeliveryRecord & { model: string | null })[]> {
    let query = this.client
      .from(RECORDS_TABLE)
      .select('*, vehicles(model)')
      .eq('record_status', 'Active')
      .order('created_at', { ascending: false });
    if (filters.dealerId) query = query.eq('dealer_id', filters.dealerId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      ...mapRecordRow(row),
      model: row.vehicles?.model ?? null,
    }));
  }

  /** Dashboard's "Pending Tractor In" KPI - vehicles already synced via
   *  Tractor In (ADR-012) that have no Delivery record at all yet, i.e.
   *  the Delivery lifecycle hasn't started tracking them. A genuine
   *  anti-join, computed JS-side over two small scoped reads (same
   *  "JS-side aggregation," not a second reporting engine, `dashboardStats()`
   *  already uses in `lib/db.ts`) rather than a database-specific `NOT
   *  EXISTS` query. */
  async countVehiclesWithoutDeliveryRecord(dealerId?: string): Promise<number> {
    let vehicleQuery = this.client.from('vehicles').select('id');
    if (dealerId) vehicleQuery = vehicleQuery.eq('dealer_id', dealerId);
    const { data: vehicles, error: vehicleError } = await vehicleQuery;
    if (vehicleError) throw vehicleError;

    let recordQuery = this.client.from(RECORDS_TABLE).select('vehicle_id').eq('record_status', 'Active');
    if (dealerId) recordQuery = recordQuery.eq('dealer_id', dealerId);
    const { data: records, error: recordError } = await recordQuery;
    if (recordError) throw recordError;

    const trackedVehicleIds = new Set((records ?? []).map((r: any) => r.vehicle_id as string));
    return (vehicles ?? []).filter((v: any) => !trackedVehicleIds.has(v.id as string)).length;
  }
}

export type { DeliveryReportRow };

/**
 * DeliveryService (ADR-027) — the one door every caller goes through for
 * the Machine Delivery lifecycle. Orchestrates Tractor In (reads
 * `vehicles`, never duplicates it), Stock Yard, PDI (links an
 * `Inspection`, ADR-017), Dealer Preparation, Customer Delivery (links an
 * `NtrRecord`, never duplicates it), Operator Training, Delivery
 * Acceptance, and Warranty Activation. Every mutating method writes to
 * the shared `record_audit_log` (module `'delivery'`).
 */
import { logAuditEvent } from '@/lib/db';
import type { SessionUser } from '@/lib/types';
import { canApproveDelivery } from '@/lib/scope';
import { DeliveryRepository, CreateDeliveryRecordInput } from './repository';
import {
  DeliveryRecord,
  DeliveryTraining,
  TrainingTopic,
  MachineDeliverySummary,
  DeliveryDashboardStats,
  DeliveryReportFilters,
  DeliveryReportRow,
  WarrantyActivationSource,
} from './types';

export interface CreateDeliveryRecordRequest {
  vehicleId: string;
  serial: string;
  dealerId: string | null;
}

export interface RecordTrainingRequest {
  operatorName: string;
  operatorPhone: string | null;
  trainerName: string;
  trainerId: string | null;
  trainingTopics: TrainingTopic[];
  trainingDate: string;
  trainingDurationMinutes: number | null;
  customerSatisfactionScore: number | null;
  notes: string | null;
}

export interface RecordAcceptanceRequest {
  acceptanceNotes: string | null;
}

function buildLeaderboard(rows: { key: string | null }[], limit = 10): { key: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.key) continue;
    counts.set(row.key, (counts.get(row.key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export class DeliveryService {
  constructor(private readonly repo: DeliveryRepository = new DeliveryRepository()) {}

  async listDeliveries(filters: Parameters<DeliveryRepository['list']>[0] = {}): Promise<DeliveryRecord[]> {
    return this.repo.list(filters);
  }

  async getDelivery(id: string): Promise<DeliveryRecord> {
    const record = await this.repo.getById(id);
    if (!record) throw new Error(`Delivery record ${id} not found`);
    return record;
  }

  /** Tractor In (stage 1) — this vehicle already exists via the existing
   *  Tractor In Sync (ADR-012, `vehicles`); this call starts the Delivery
   *  aggregate's own tracking, it never re-syncs or duplicates the
   *  vehicle row itself. `stage: 'TractorIn'` is the DB column default. */
  async createDeliveryRecord(input: CreateDeliveryRecordRequest, session: SessionUser): Promise<DeliveryRecord> {
    const created = await this.repo.create({
      vehicleId: input.vehicleId,
      serial: input.serial,
      dealerId: input.dealerId,
      createdBy: session.username,
    } satisfies CreateDeliveryRecordInput);

    await logAuditEvent({
      module: 'delivery',
      recordId: created.id,
      recordRef: created.deliveryRef,
      eventType: 'Created',
      performedBy: session.username,
    });
    return created;
  }

  async receiveAtStockYard(id: string, location: string | null, session: SessionUser): Promise<DeliveryRecord> {
    const updated = await this.repo.update(id, {
      stage: 'StockYard',
      stockYardReceivedAt: new Date().toISOString(),
      stockYardLocation: location,
      updatedBy: session.username,
    });
    await this.logStageEvent(updated, 'StockYard', session);
    return updated;
  }

  /** Links a completed `Inspection` (ADR-017) — never duplicates PDI
   *  fields onto this table. Advances to `DealerPreparation` once the
   *  linked inspection is `Completed`. */
  async linkInspection(id: string, inspectionId: string, inspectionCompleted: boolean, session: SessionUser): Promise<DeliveryRecord> {
    const updated = await this.repo.update(id, {
      stage: inspectionCompleted ? 'DealerPreparation' : 'PDI',
      pdiInspectionId: inspectionId,
      updatedBy: session.username,
    });
    await this.logStageEvent(updated, updated.stage, session);
    return updated;
  }

  async completeDealerPrep(id: string, notes: string | null, session: SessionUser): Promise<DeliveryRecord> {
    const updated = await this.repo.update(id, {
      stage: 'CustomerDelivery',
      dealerPreparationCompletedAt: new Date().toISOString(),
      dealerPreparationNotes: notes,
      updatedBy: session.username,
    });
    await this.logStageEvent(updated, 'CustomerDelivery', session);
    return updated;
  }

  /** Customer Delivery — links an existing `NtrRecord` (never duplicates
   *  Customer/Machine/Photos/Delivery Date fields that NTR already
   *  captures). Advances to `OperatorTraining`. */
  async linkNtr(id: string, ntrId: string, session: SessionUser): Promise<DeliveryRecord> {
    const updated = await this.repo.update(id, {
      stage: 'OperatorTraining',
      ntrId,
      updatedBy: session.username,
    });
    await this.logStageEvent(updated, 'OperatorTraining', session);
    return updated;
  }

  async recordTraining(id: string, input: RecordTrainingRequest, session: SessionUser): Promise<DeliveryRecord> {
    const before = await this.getDelivery(id);
    const training: DeliveryTraining = await this.repo.createTraining({
      deliveryRecordId: id,
      serial: before.serial,
      operatorName: input.operatorName,
      operatorPhone: input.operatorPhone,
      trainerName: input.trainerName,
      trainerId: input.trainerId,
      trainingTopics: input.trainingTopics,
      trainingDate: input.trainingDate,
      trainingDurationMinutes: input.trainingDurationMinutes,
      customerSatisfactionScore: input.customerSatisfactionScore,
      notes: input.notes,
      createdBy: session.username,
    });
    const updated = await this.repo.update(id, {
      stage: 'DeliveryAcceptance',
      trainingId: training.id,
      updatedBy: session.username,
    });
    await logAuditEvent({
      module: 'delivery',
      recordId: id,
      recordRef: updated.deliveryRef,
      eventType: 'SystemEvent',
      fieldName: 'Training',
      newValue: input.operatorName,
      performedBy: session.username,
    });
    return updated;
  }

  /** Delivery Acceptance — the trust-conferring action, gated by
   *  `canApproveDelivery` (SuperAdmin/CentralAdmin/DealerAdmin only).
   *  Automatically triggers Warranty Activation (`source:
   *  'DeliveryAcceptance'`) — closing the gap
   *  `03-MACHINE-LIFECYCLE-AND-TIMELINE.md` itself names: "Warranty
   *  Activated is never emitted as a point-in-time event today." */
  async recordAcceptance(id: string, input: RecordAcceptanceRequest, session: SessionUser): Promise<DeliveryRecord> {
    if (!canApproveDelivery(session.role)) {
      throw new Error(`Role ${session.role} may not record Delivery Acceptance`);
    }
    const now = new Date().toISOString();
    const updated = await this.repo.update(id, {
      stage: 'WarrantyActivation',
      acceptanceSignedAt: now,
      acceptanceSignedBy: session.username,
      acceptanceNotes: input.acceptanceNotes,
      updatedBy: session.username,
    });
    await logAuditEvent({
      module: 'delivery',
      recordId: id,
      recordRef: updated.deliveryRef,
      eventType: 'SystemEvent',
      fieldName: 'Acceptance',
      newValue: session.username,
      performedBy: session.username,
    });
    return this.activateWarranty(id, 'DeliveryAcceptance', session);
  }

  /** Warranty Activation — one point-in-time event (`warrantyActivatedAt`
   *  + `warrantyActivationSource`), not a claims/policy ledger (that
   *  stays future work). Auto-triggered by `recordAcceptance()`, or
   *  callable directly for a manual/out-of-band activation. */
  async activateWarranty(id: string, source: WarrantyActivationSource, session: SessionUser): Promise<DeliveryRecord> {
    if (source === 'Manual' && !canApproveDelivery(session.role)) {
      throw new Error(`Role ${session.role} may not manually activate Warranty`);
    }
    const updated = await this.repo.update(id, {
      stage: 'Completed',
      overallStatus: 'Completed',
      warrantyActivatedAt: new Date().toISOString(),
      warrantyActivationSource: source,
      updatedBy: session.username,
    });
    await logAuditEvent({
      module: 'delivery',
      recordId: id,
      recordRef: updated.deliveryRef,
      eventType: 'SystemEvent',
      fieldName: 'WarrantyActivated',
      newValue: source,
      performedBy: session.username,
    });
    return updated;
  }

  /** Machine Passport's Delivery section — read-only summary. `null`
   *  when this machine has no delivery record yet. */
  async getDeliveryForMachine(serial: string): Promise<MachineDeliverySummary | null> {
    const record = await this.repo.getMostRecentForSerial(serial);
    if (!record) return null;
    let trainingCompleted = false;
    if (record.trainingId) {
      const training = await this.repo.getTrainingById(record.trainingId);
      trainingCompleted = !!training;
    }
    return {
      deliveryRef: record.deliveryRef,
      stage: record.stage,
      overallStatus: record.overallStatus,
      pdiResult: null,
      ntrId: record.ntrId,
      trainingCompleted,
      warrantyActivatedAt: record.warrantyActivatedAt,
      href: `/delivery/records/${record.id}`,
    };
  }

  /** Delivery Dashboard KPIs — JS-side aggregation over one scoped read,
   *  the same shape `dashboardStats()`/`buildLeaderboard()` (`lib/db.ts`)
   *  already use for Quality, not a second reporting engine. */
  async getDashboardStats(dealerId?: string): Promise<DeliveryDashboardStats> {
    const rows = await this.repo.listActiveWithRelated(dealerId ? { dealerId } : {});

    const pendingDelivery = rows.filter((r) => r.stage !== 'Completed').length;
    const pendingPdi = rows.filter((r) => r.stage === 'StockYard' || r.stage === 'PDI').length;
    const pendingTraining = rows.filter((r) => r.stage === 'OperatorTraining').length;
    const warrantyPending = rows.filter((r) => r.stage === 'WarrantyActivation').length;

    const withResult = rows.filter((r) => r.pdiResult !== null);
    const passCount = withResult.filter((r) => r.pdiResult === 'Pass').length;
    const deliveryQualityPassRate = withResult.length > 0 ? Math.round((passCount / withResult.length) * 1000) / 10 : null;

    const dealerRanking = buildLeaderboard(rows.map((r) => ({ key: r.dealerId })));
    const technicianRanking = buildLeaderboard(rows.map((r) => ({ key: r.technicianName })));

    return { pendingDelivery, pendingPdi, pendingTraining, warrantyPending, deliveryQualityPassRate, dealerRanking, technicianRanking };
  }

  /** One consolidated dataset for all 7 named report types (Dealer/
   *  Technician/Model/Checklist Version/Delivery Duration/Training
   *  Completion/Warranty Activation) — filters/columns of one report,
   *  not 7 pipelines (Reuse-before-Build). */
  async getDeliveryReport(filters: DeliveryReportFilters = {}): Promise<DeliveryReportRow[]> {
    const rows = await this.repo.listActiveWithRelated(filters.dealerId ? { dealerId: filters.dealerId } : {});

    return rows
      .filter((r) => !filters.technicianName || r.technicianName === filters.technicianName)
      .filter((r) => !filters.model || r.model === filters.model)
      .filter((r) => !filters.dateFrom || r.createdAt >= filters.dateFrom)
      .filter((r) => !filters.dateTo || r.createdAt <= filters.dateTo)
      .map((r) => ({
        deliveryRef: r.deliveryRef,
        serial: r.serial,
        model: r.model,
        dealerId: r.dealerId,
        technicianName: r.technicianName,
        checklistVersion: r.checklistVersion,
        pdiResult: r.pdiResult,
        deliveryDurationDays: r.warrantyActivatedAt
          ? Math.round((new Date(r.warrantyActivatedAt).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : null,
        trainingCompleted: !!r.trainingId,
        warrantyActivated: !!r.warrantyActivatedAt,
        stage: r.stage,
      }));
  }

  private async logStageEvent(record: DeliveryRecord, newStage: string, session: SessionUser): Promise<void> {
    await logAuditEvent({
      module: 'delivery',
      recordId: record.id,
      recordRef: record.deliveryRef,
      eventType: 'StatusChanged',
      fieldName: 'Stage',
      newValue: newStage,
      performedBy: session.username,
    });
  }
}

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
import { canApproveDelivery, canAccessImportInspection } from '@/lib/scope';
import { InspectionService } from '@/features/inspection';
import { VehicleEventPublisher } from '@/features/vehicle-event/publisher';
import { createVehicleEventPublisher } from '@/features/vehicle-event/factory';
import { DeliveryRepository, CreateDeliveryRecordInput } from './repository';
import {
  DeliveryRecord,
  DeliveryTraining,
  TrainingTopic,
  MachineDeliverySummary,
  DeliveryDashboardStats,
  DeliveryReportFilters,
  DeliveryReportRow,
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
  private _eventPublisher?: VehicleEventPublisher;

  constructor(
    private readonly repo: DeliveryRepository = new DeliveryRepository(),
    private readonly inspectionService: InspectionService = new InspectionService(),
    eventPublisher?: VehicleEventPublisher
  ) {
    this._eventPublisher = eventPublisher;
  }

  /** Lazy, not a constructor default - see the identical comment on
   *  `InspectionService.eventPublisher` (docs/standards/
   *  SERVICE_CONSTRUCTION_STANDARD.md). */
  private get eventPublisher(): VehicleEventPublisher {
    if (!this._eventPublisher) this._eventPublisher = createVehicleEventPublisher();
    return this._eventPublisher;
  }

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
   *  linked inspection is `Completed`. Gated to MSEAL roles
   *  (`canAccessImportInspection`) - a Dealer role must not be able to
   *  read/act on Import Inspection state through this cross-domain link,
   *  even though Import Inspection's own CRUD is already MSEAL-only. */
  async linkInspection(id: string, inspectionId: string, inspectionCompleted: boolean, session: SessionUser): Promise<DeliveryRecord> {
    if (!canAccessImportInspection(session.role)) {
      throw new Error(`Role ${session.role} may not link an Import Inspection to a Delivery record`);
    }
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
   *  Business-domain correction: no longer auto-triggers Warranty
   *  Activation - NTR is the sole ownership-transfer event and the sole
   *  legitimate Warranty trigger (see `activateWarrantyFromNtr`).
   *  Acceptance only records the stage; Warranty activates independently
   *  once an NTR record is created for this machine. */
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
    return updated;
  }

  /** Warranty Activation — one point-in-time event (`warrantyActivatedAt`
   *  + `warrantyActivationSource: 'NTR'`), not a claims/policy ledger
   *  (that stays future work). NTR is the ownership-transfer event and the
   *  ONLY caller of this method (from the NTR creation route's own
   *  non-blocking side-effect, mirroring its existing attachments-reassign
   *  pattern) - Warranty is never activated manually. Idempotent: a
   *  machine whose Warranty already activated is left unchanged, since an
   *  NTR correction/resubmission must never re-activate or overwrite the
   *  original activation moment. Find-or-creates the Delivery record for
   *  this vehicle - not every machine will have gone through every prior
   *  Delivery stage by the time NTR completes, and Warranty Activation
   *  must not be blocked on Delivery stage bookkeeping this domain
   *  correction does not otherwise restructure. Takes a minimal actor
   *  (`{ username }`), not a full `SessionUser` - this is called from both
   *  NTR-creation paths (the manual route's full session, and Legacy
   *  Import's `{ username }`-only actor), and nothing here ever reads a
   *  role. */
  async activateWarrantyFromNtr(input: { vehicleId: string; serial: string; dealerId: string | null; ntrId: string }, actor: { username: string }): Promise<DeliveryRecord> {
    let record = await this.repo.getMostRecentForSerial(input.serial);
    if (!record) {
      record = await this.repo.create({
        vehicleId: input.vehicleId,
        serial: input.serial,
        dealerId: input.dealerId,
        createdBy: actor.username,
      } satisfies CreateDeliveryRecordInput);
    }
    if (record.warrantyActivatedAt) return record;

    const updated = await this.repo.update(record.id, {
      stage: 'Completed',
      overallStatus: 'Completed',
      ntrId: input.ntrId,
      warrantyActivatedAt: new Date().toISOString(),
      warrantyActivationSource: 'NTR',
      updatedBy: actor.username,
    });
    await logAuditEvent({
      module: 'delivery',
      recordId: updated.id,
      recordRef: updated.deliveryRef,
      eventType: 'SystemEvent',
      fieldName: 'WarrantyActivated',
      newValue: 'NTR',
      performedBy: actor.username,
    });
    await this.eventPublisher
      .publishWarrantyActivated({
        serial: updated.serial,
        referenceId: updated.deliveryRef,
        entityId: updated.id,
        eventDatetime: updated.warrantyActivatedAt as string,
        actor: { username: actor.username },
        source: 'NTR',
      })
      .catch((err) => console.error('publish WARRANTY_ACTIVATED event error', err));
    return updated;
  }

  /** Machine Passport's Delivery section — read-only summary. `null`
   *  when this machine has no delivery record yet. `pdiResult` is read
   *  through `InspectionService.listInspectionsByIds()` (never a direct
   *  `inspections` query from this service, and never the MSEAL-gated
   *  `getInspection()` - the Passport's own summary field is dealer-
   *  visible, like `listInspectionsForSerial()`) - Delivery links an
   *  Inspection by id, it does not own or duplicate its fields. */
  async getDeliveryForMachine(serial: string): Promise<MachineDeliverySummary | null> {
    const record = await this.repo.getMostRecentForSerial(serial);
    if (!record) return null;
    let trainingCompleted = false;
    if (record.trainingId) {
      const training = await this.repo.getTrainingById(record.trainingId);
      trainingCompleted = !!training;
    }
    let pdiResult: string | null = null;
    if (record.pdiInspectionId) {
      const [inspection] = await this.inspectionService.listInspectionsByIds([record.pdiInspectionId]);
      pdiResult = inspection?.result ?? null;
    }
    return {
      deliveryRef: record.deliveryRef,
      stage: record.stage,
      overallStatus: record.overallStatus,
      pdiResult,
      ntrId: record.ntrId,
      trainingCompleted,
      warrantyActivatedAt: record.warrantyActivatedAt,
    };
  }

  /** Delivery Dashboard - the official KPI contract (docs/architecture/
   *  DELIVERY_PLATFORM.md §8). JS-side aggregation over scoped reads, the
   *  same shape `dashboardStats()`/`buildLeaderboard()` (`lib/db.ts`)
   *  already use for Quality, not a second reporting engine. Every value
   *  here is live-computed - two of the ten officially named KPIs (Open
   *  Delivery Findings, Dealer Delivery SLA) have no field at all, rather
   *  than a fabricated placeholder, since neither has a defined data
   *  model yet (see `DeliveryDashboardStats`'s own doc comment). */
  async getDashboardStats(dealerId?: string): Promise<DeliveryDashboardStats> {
    const [rows, pendingTractorIn] = await Promise.all([
      this.repo.listActiveWithRelated(dealerId ? { dealerId } : {}),
      this.repo.countVehiclesWithoutDeliveryRecord(dealerId),
    ]);
    const inspectionById = await this.composeInspectionData(rows);

    const pendingStockYard = rows.filter((r) => r.stage === 'TractorIn').length;
    const pendingPdi = rows.filter((r) => r.stage === 'StockYard').length;
    const pendingDelivery = rows.filter((r) => r.stage !== 'Completed').length;
    const pendingTraining = rows.filter((r) => r.stage === 'OperatorTraining').length;
    const warrantyWaiting = rows.filter((r) => r.stage === 'WarrantyActivation').length;

    const results = rows.map((r) => (r.pdiInspectionId ? inspectionById.get(r.pdiInspectionId)?.result ?? null : null));
    const withResult = results.filter((r): r is string => r !== null);
    const passCount = withResult.filter((r) => r === 'Pass').length;
    const pdiFirstPassRate = withResult.length > 0 ? Math.round((passCount / withResult.length) * 1000) / 10 : null;

    const activated = rows.filter((r) => r.warrantyActivatedAt !== null);
    const averageDeliveryLeadTimeDays =
      activated.length > 0
        ? Math.round(
            (activated.reduce((sum, r) => sum + (new Date(r.warrantyActivatedAt as string).getTime() - new Date(r.createdAt).getTime()), 0) /
              activated.length /
              (1000 * 60 * 60 * 24)) *
              10
          ) / 10
        : null;

    const dealerRanking = buildLeaderboard(rows.map((r) => ({ key: r.dealerId })));
    const technicianRanking = buildLeaderboard(
      rows.map((r) => ({ key: r.pdiInspectionId ? inspectionById.get(r.pdiInspectionId)?.technicianName ?? null : null }))
    );

    return {
      pendingTractorIn,
      pendingStockYard,
      pendingPdi,
      pendingDelivery,
      pendingTraining,
      warrantyWaiting,
      pdiFirstPassRate,
      averageDeliveryLeadTimeDays,
      dealerRanking,
      technicianRanking,
    };
  }

  /** One consolidated dataset for all 7 named report types (Dealer/
   *  Technician/Model/Checklist Version/Delivery Duration/Training
   *  Completion/Warranty Activation) — filters/columns of one report,
   *  not 7 pipelines (Reuse-before-Build). */
  async getDeliveryReport(filters: DeliveryReportFilters = {}): Promise<DeliveryReportRow[]> {
    const rows = await this.repo.listActiveWithRelated(filters.dealerId ? { dealerId: filters.dealerId } : {});
    const inspectionById = await this.composeInspectionData(rows);

    return rows
      .map((r) => ({ row: r, inspection: r.pdiInspectionId ? inspectionById.get(r.pdiInspectionId) : undefined }))
      .filter(({ inspection }) => !filters.technicianName || inspection?.technicianName === filters.technicianName)
      .filter(({ row }) => !filters.model || row.model === filters.model)
      .filter(({ row }) => !filters.dateFrom || row.createdAt >= filters.dateFrom)
      .filter(({ row }) => !filters.dateTo || row.createdAt <= filters.dateTo)
      .map(({ row: r, inspection }) => ({
        deliveryRef: r.deliveryRef,
        serial: r.serial,
        model: r.model,
        dealerId: r.dealerId,
        technicianName: inspection?.technicianName ?? null,
        checklistVersion: inspection?.checklistVersion ?? null,
        pdiResult: inspection?.result ?? null,
        deliveryDurationDays: r.warrantyActivatedAt
          ? Math.round((new Date(r.warrantyActivatedAt).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : null,
        trainingCompleted: !!r.trainingId,
        warrantyActivated: !!r.warrantyActivatedAt,
        stage: r.stage,
      }));
  }

  /** Composes the Inspection fields the Dashboard/Report needs
   *  (technician, checklist version, result) via `InspectionService`,
   *  keyed by inspection id - the read path that replaces embedding
   *  `inspections` columns directly into `DeliveryRepository`'s own
   *  query (Delivery orchestrates PDI, it does not reach into PDI's own
   *  table). */
  private async composeInspectionData(
    rows: { pdiInspectionId: string | null }[]
  ): Promise<Map<string, { technicianName: string | null; checklistVersion: string | null; result: string | null }>> {
    const ids = Array.from(new Set(rows.map((r) => r.pdiInspectionId).filter((id): id is string => id !== null)));
    const inspections = await this.inspectionService.listInspectionsByIds(ids);
    return new Map(
      inspections.map((i) => [i.id, { technicianName: i.technicianName, checklistVersion: i.checklistVersion, result: i.result }])
    );
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

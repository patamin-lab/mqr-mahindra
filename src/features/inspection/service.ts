/**
 * InspectionService (ADR-017) — the one door every caller goes through for
 * Import Inspection (MSEAL PDI). Every mutating method writes to the
 * shared `record_audit_log` (module `'pdi'`) via the existing
 * `logAuditEvent()` — no second audit table. Import Inspection belongs
 * exclusively to MSEAL - every gated method below is enforced
 * server-side by `canAccessImportInspection` (`lib/scope.ts`), never by
 * nav/button visibility alone (`SECURITY_STANDARD.md`).
 */
import { logAuditEvent } from '@/lib/db';
import type { SessionUser } from '@/lib/types';
import { canAccessImportInspection } from '@/lib/scope';
import { KnowledgeService } from '@/features/knowledge';
import { VehicleEventPublisher } from '@/features/vehicle-event/publisher';
import { createVehicleEventPublisher } from '@/features/vehicle-event/factory';
import { InspectionRepository, CreateInspectionInput } from './repository';
import {
  Inspection,
  InspectionReason,
  ChecklistItem,
  Finding,
  FindingDisposition,
  FactoryFeedbackStatus,
  Measurement,
  PartReplaced,
  DEFAULT_PDI_CHECKLIST,
  DEFAULT_PDI_CHECKLIST_VERSION,
  computeNextRePdiDueDate,
  isInspectionExpired,
  InspectionDashboardStats,
} from './types';

export interface CreateInitialInspectionRequest {
  vehicleId: string;
  serial: string;
  dealerId: string | null;
  technicianId: string | null;
  technicianName: string;
  technicianCertificationRef: string | null;
}

export interface AddFindingInput {
  severity: Finding['severity'];
  system: string;
  description: string;
}

export interface AddMeasurementInput {
  parameter: string;
  value: number;
  unit: string;
  specMin: number | null;
  specMax: number | null;
}

export interface AddPartReplacedInput {
  partName: string;
  partNumber: string | null;
  qty: number;
  reason: string;
}

function assertMsealAccess(role: SessionUser['role']): void {
  if (!canAccessImportInspection(role)) {
    throw new Error(`Role ${role} may not access Import Inspection - it belongs exclusively to MSEAL`);
  }
}

export class InspectionService {
  private _eventPublisher?: VehicleEventPublisher;

  constructor(
    private readonly repo: InspectionRepository = new InspectionRepository(),
    private readonly knowledgeService: KnowledgeService = new KnowledgeService(),
    eventPublisher?: VehicleEventPublisher
  ) {
    this._eventPublisher = eventPublisher;
  }

  /** Lazy, not a constructor default - `createVehicleEventPublisher()`
   *  eagerly constructs an eager-initialized repository (a documented,
   *  grandfathered Rule 6 exception); this class is constructed at module
   *  scope in every route file, so resolving it here (only when a
   *  publish actually happens, inside a request-scoped method) keeps
   *  construction itself side-effect free (docs/standards/
   *  SERVICE_CONSTRUCTION_STANDARD.md). */
  private get eventPublisher(): VehicleEventPublisher {
    if (!this._eventPublisher) this._eventPublisher = createVehicleEventPublisher();
    return this._eventPublisher;
  }

  async listInspections(filters: Parameters<InspectionRepository['list']>[0] = {}, session: SessionUser): Promise<Inspection[]> {
    assertMsealAccess(session.role);
    return this.repo.list(filters);
  }

  async getInspection(id: string, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const inspection = await this.repo.getById(id);
    if (!inspection) throw new Error(`Inspection ${id} not found`);
    return inspection;
  }

  /** Machine Passport's own read path - not gated by
   *  `canAccessImportInspection`, since the Passport itself is dealer-
   *  visible and must show *that inspections occurred* (count/dates/
   *  release status) even though the underlying detail screens remain
   *  MSEAL-only. Callers rendering full findings/evidence must still
   *  gate that part of the UI themselves. */
  async listInspectionsForSerial(serial: string): Promise<Inspection[]> {
    return this.repo.listForSerial(serial);
  }

  async listInspectionsByIds(ids: string[]): Promise<Inspection[]> {
    return this.repo.listByIds(ids);
  }

  /** Import Inspection Dashboard's own read path (MSEAL-internal). */
  async listActiveInspections(session: SessionUser, dealerId?: string): Promise<Inspection[]> {
    assertMsealAccess(session.role);
    return this.repo.listActive(dealerId);
  }

  /** Import Inspection Dashboard - the official KPI contract. JS-side
   *  aggregation over one scoped read (`listActive()`), the same
   *  "aggregate in JS, not a second reporting engine" pattern
   *  `DeliveryService.getDashboardStats()`/`dashboardStats()` (`lib/db.ts`)
   *  already use. */
  async getDashboardStats(session: SessionUser, dealerId?: string): Promise<InspectionDashboardStats> {
    assertMsealAccess(session.role);
    const inspections = await this.repo.listActive(dealerId);
    const today = new Date().toISOString().slice(0, 10);

    const pendingImportInspection = inspections.filter((i) => i.status === 'Scheduled' || i.status === 'InProgress').length;
    const pendingRePdi = inspections.filter((i) => i.releaseStatus === 'RequiresRePdi').length;
    const expiredInspection = inspections.filter((i) => isInspectionExpired(i, today)).length;
    const releasedToDealer = inspections.filter((i) => i.releaseStatus === 'ReleasedToDealer').length;

    const allFindings = inspections.flatMap((i) => i.findings);
    const criticalFindings = allFindings.filter((f) => f.severity === 'Critical').length;
    const factoryFeedbackPending = allFindings.filter((f) => f.factoryFeedbackStatus === 'NotSent').length;

    const completed = inspections.filter((i) => i.status === 'Completed');
    const averageInspectionHours =
      completed.length > 0
        ? Math.round(
            (completed.reduce((sum, i) => sum + (new Date(i.updatedAt).getTime() - new Date(i.createdAt).getTime()), 0) /
              completed.length /
              (1000 * 60 * 60)) *
              10
          ) / 10
        : null;

    const withResult = inspections.filter((i) => i.result !== null);
    const inspectionPassRate = withResult.length > 0 ? Math.round((withResult.filter((i) => i.result === 'Pass').length / withResult.length) * 1000) / 10 : null;

    return {
      pendingImportInspection,
      pendingRePdi,
      expiredInspection,
      releasedToDealer,
      criticalFindings,
      findingsByModel: null,
      findingsByFactory: null,
      factoryFeedbackPending,
      averageInspectionHours,
      inspectionPassRate,
    };
  }

  /** Initial PDI (`inspectionType: 'PDI'`, `inspectionSequence: 1`,
   *  `inspectionReason: 'INITIAL'`) - starts from the one seeded default
   *  checklist template (ch.04's checklist-configurability question is
   *  deferred - see docs/architecture/INSPECTION_PDI.md). */
  async createInitialInspection(input: CreateInitialInspectionRequest, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const checklist: ChecklistItem[] = DEFAULT_PDI_CHECKLIST.map((item) => ({ ...item, result: null, remark: null }));
    const created = await this.repo.create({
      inspectionType: 'PDI',
      inspectionReason: 'INITIAL',
      inspectionSequence: 1,
      previousInspectionId: null,
      vehicleId: input.vehicleId,
      serial: input.serial,
      dealerId: input.dealerId,
      checklistVersion: DEFAULT_PDI_CHECKLIST_VERSION,
      checklist,
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      technicianCertificationRef: input.technicianCertificationRef,
      createdBy: session.username,
    } satisfies CreateInspectionInput);

    await logAuditEvent({
      module: 'pdi',
      recordId: created.id,
      recordRef: created.inspectionRef,
      eventType: 'Created',
      performedBy: session.username,
    });
    return created;
  }

  /** RE-PDI - a NEW, immutable inspection chained to the one it follows
   *  (`previousInspectionId`), never an overwrite of the prior record.
   *  `inspectionSequence` increments from the previous inspection's own
   *  sequence, so a machine's full chain (`PDI #1 -> RE_PDI #2 ->
   *  RE_PDI #3`) is reconstructable by sequence order alone. */
  async createRePdi(
    previousInspectionId: string,
    input: { reason: InspectionReason; technicianId: string | null; technicianName: string; technicianCertificationRef: string | null },
    session: SessionUser
  ): Promise<Inspection> {
    assertMsealAccess(session.role);
    const previous = await this.repo.getById(previousInspectionId);
    if (!previous) throw new Error(`Inspection ${previousInspectionId} not found`);

    const checklist: ChecklistItem[] = DEFAULT_PDI_CHECKLIST.map((item) => ({ ...item, result: null, remark: null }));
    const created = await this.repo.create({
      inspectionType: 'RE_PDI',
      inspectionReason: input.reason,
      inspectionSequence: previous.inspectionSequence + 1,
      previousInspectionId,
      vehicleId: previous.vehicleId,
      serial: previous.serial,
      dealerId: previous.dealerId,
      checklistVersion: DEFAULT_PDI_CHECKLIST_VERSION,
      checklist,
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      technicianCertificationRef: input.technicianCertificationRef,
      createdBy: session.username,
    } satisfies CreateInspectionInput);

    await logAuditEvent({
      module: 'pdi',
      recordId: created.id,
      recordRef: created.inspectionRef,
      eventType: 'Created',
      fieldName: 'RePdi',
      oldValue: previous.inspectionRef,
      performedBy: session.username,
    });
    return created;
  }

  async updateChecklist(id: string, checklist: ChecklistItem[], session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const before = await this.getInspectionUnchecked(id);
    const updated = await this.repo.update(id, {
      checklist,
      status: before.status === 'Scheduled' ? 'InProgress' : before.status,
      updatedBy: session.username,
    });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'FieldChanged',
      fieldName: 'Checklist',
      performedBy: session.username,
    });
    return updated;
  }

  async addFinding(id: string, input: AddFindingInput, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const before = await this.getInspectionUnchecked(id);
    const finding: Finding = {
      id: crypto.randomUUID(),
      ...input,
      disposition: 'PendingReview',
      factoryFeedbackStatus: 'NotSent',
      correctiveActionReference: null,
      knowledgeCaseId: null,
    };
    const updated = await this.repo.update(id, { findings: [...before.findings, finding], updatedBy: session.username });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'FieldChanged',
      fieldName: 'Finding',
      newValue: input.description,
      performedBy: session.username,
    });
    return updated;
  }

  /** Factory Feedback Model - per-finding disposition/status/corrective-
   *  action tracking, distinct from the finding's own description.
   *  Designed to remain extensible toward a future Supplier Quality
   *  integration without a schema change (`correctiveActionReference` is
   *  a free-text pointer). */
  async updateFindingFactoryFeedback(
    id: string,
    findingId: string,
    input: { disposition?: FindingDisposition; factoryFeedbackStatus?: FactoryFeedbackStatus; correctiveActionReference?: string | null },
    session: SessionUser
  ): Promise<Inspection> {
    assertMsealAccess(session.role);
    const before = await this.getInspectionUnchecked(id);
    const finding = before.findings.find((f) => f.id === findingId);
    if (!finding) throw new Error(`Finding ${findingId} not found on inspection ${id}`);
    const updatedFinding: Finding = {
      ...finding,
      disposition: input.disposition ?? finding.disposition,
      factoryFeedbackStatus: input.factoryFeedbackStatus ?? finding.factoryFeedbackStatus,
      correctiveActionReference: input.correctiveActionReference !== undefined ? input.correctiveActionReference : finding.correctiveActionReference,
    };
    const updatedFindings = before.findings.map((f) => (f.id === findingId ? updatedFinding : f));
    const updated = await this.repo.update(id, { findings: updatedFindings, updatedBy: session.username });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'FieldChanged',
      fieldName: 'FactoryFeedbackStatus',
      newValue: updatedFinding.factoryFeedbackStatus,
      performedBy: session.username,
    });
    return updated;
  }

  /** Inspection-level Factory Feedback - the overall narrative summary
   *  sent back to the factory/import side, separate from each finding's
   *  own structured tracking above. */
  async recordFactoryFeedback(id: string, feedback: string, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const updated = await this.repo.update(id, { factoryFeedback: feedback, updatedBy: session.username });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'SystemEvent',
      fieldName: 'FactoryFeedback',
      newValue: feedback,
      performedBy: session.username,
    });
    return updated;
  }

  async addMeasurement(id: string, input: AddMeasurementInput, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const before = await this.getInspectionUnchecked(id);
    const inRange = input.specMin === null && input.specMax === null
      ? null
      : (input.specMin === null || input.value >= input.specMin) && (input.specMax === null || input.value <= input.specMax);
    const measurement: Measurement = { id: crypto.randomUUID(), ...input, inRange };
    const updated = await this.repo.update(id, { measurements: [...before.measurements, measurement], updatedBy: session.username });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'FieldChanged',
      fieldName: 'Measurement',
      newValue: `${input.parameter}: ${input.value}${input.unit}`,
      performedBy: session.username,
    });
    return updated;
  }

  async addPartReplaced(id: string, input: AddPartReplacedInput, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const before = await this.getInspectionUnchecked(id);
    const part: PartReplaced = { id: crypto.randomUUID(), ...input };
    const updated = await this.repo.update(id, { partsReplaced: [...before.partsReplaced, part], updatedBy: session.username });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'FieldChanged',
      fieldName: 'PartReplaced',
      newValue: input.partName,
      performedBy: session.username,
    });
    return updated;
  }

  /** Requires the checklist to have no unset (`null`) results before
   *  completing. On Pass, computes `nextRePdiDueDate` (the configurable
   *  expiration window, default 180 days) and leaves `releaseStatus:
   *  'Pending'` - Release to Dealer is always an explicit, separate
   *  action (`releaseToDealer()`), never implied by completion alone. On
   *  Fail, sets `releaseStatus: 'RequiresRePdi'` immediately - the
   *  machine cannot be released without a RE-PDI. Publishes
   *  `PDI_COMPLETED` on the shared Machine Timeline (the event code was
   *  already reserved in `event_definitions`, unused until this pass -
   *  reused, not duplicated). */
  async completeInspection(id: string, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const before = await this.getInspectionUnchecked(id);
    const unset = before.checklist.filter((c) => c.result === null);
    if (unset.length > 0) {
      throw new Error(`Cannot complete inspection - ${unset.length} checklist item(s) have no result recorded`);
    }
    const anyFail = before.checklist.some((c) => c.result === 'Fail');
    const result = anyFail ? (before.findings.length > 0 ? 'Fail' : 'Conditional') : 'Pass';
    const inspectionDate = new Date().toISOString();
    const nextRePdiDueDate = result === 'Fail' ? null : computeNextRePdiDueDate(inspectionDate);

    const updated = await this.repo.update(id, {
      status: 'Completed',
      result,
      releaseStatus: result === 'Fail' ? 'RequiresRePdi' : 'Pending',
      nextRePdiDueDate,
      updatedBy: session.username,
    });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'StatusChanged',
      fieldName: 'Status',
      oldValue: before.status,
      newValue: 'Completed',
      performedBy: session.username,
    });
    await this.eventPublisher
      .publishPdiCompleted({
        serial: updated.serial,
        referenceId: updated.inspectionRef,
        entityId: updated.id,
        eventDatetime: inspectionDate,
        actor: { username: session.username },
        inspector: updated.technicianName,
        result: updated.result,
      })
      .catch((err) => console.error('publish PDI_COMPLETED event error', err));
    return updated;
  }

  /** Digital Sign-off — the technician confirming the completed
   *  inspection is theirs. */
  async signOff(id: string, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const before = await this.getInspectionUnchecked(id);
    if (before.status !== 'Completed') throw new Error('Only a Completed inspection can be signed off');
    const updated = await this.repo.update(id, {
      signedOffBy: session.username,
      signedOffAt: new Date().toISOString(),
      updatedBy: session.username,
    });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'SystemEvent',
      fieldName: 'SignOff',
      newValue: session.username,
      performedBy: session.username,
    });
    return updated;
  }

  /** Released to Dealer - the MSEAL-internal decision that ends this
   *  machine's Import Inspection stage and allows the Dealer-facing
   *  Delivery flow to proceed. Requires a Passed, signed-off, completed
   *  inspection that has not expired. Publishes `RELEASED_TO_DEALER` on
   *  the shared Machine Timeline (new event code, additive to the
   *  existing Platform Event Framework catalog). */
  async releaseToDealer(id: string, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const before = await this.getInspectionUnchecked(id);
    if (before.status !== 'Completed' || before.result !== 'Pass') {
      throw new Error('Only a Completed, Passed inspection may be Released to Dealer');
    }
    if (!before.signedOffAt) throw new Error('Cannot release to dealer before Digital Sign-off');
    if (before.nextRePdiDueDate && before.nextRePdiDueDate < new Date().toISOString().slice(0, 10)) {
      throw new Error('This inspection has expired - a RE-PDI is required before Release to Dealer');
    }

    const updated = await this.repo.update(id, { releaseStatus: 'ReleasedToDealer', updatedBy: session.username });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'SystemEvent',
      fieldName: 'ReleaseStatus',
      oldValue: before.releaseStatus,
      newValue: 'ReleasedToDealer',
      performedBy: session.username,
    });
    await this.eventPublisher
      .publishReleasedToDealer({
        serial: updated.serial,
        referenceId: updated.inspectionRef,
        entityId: updated.id,
        eventDatetime: new Date().toISOString(),
        actor: { username: session.username },
      })
      .catch((err) => console.error('publish RELEASED_TO_DEALER event error', err));
    return updated;
  }

  /** Structured Findings may become Knowledge Candidates through the
   *  existing Knowledge Platform - "do not duplicate entry": this calls
   *  `KnowledgeService.createCandidate()`/`.addEvidence()` directly, then
   *  stores the resulting `knowledgeCaseId` back onto the finding. */
  async promoteFindingToKnowledge(inspectionId: string, findingId: string, session: SessionUser): Promise<Inspection> {
    assertMsealAccess(session.role);
    const inspection = await this.getInspectionUnchecked(inspectionId);
    const finding = inspection.findings.find((f) => f.id === findingId);
    if (!finding) throw new Error(`Finding ${findingId} not found on inspection ${inspectionId}`);
    if (finding.knowledgeCaseId) return inspection;

    const kase = await this.knowledgeService.createCandidate(
      {
        symptom: finding.description,
        affectedSystem: finding.system,
        productFamilyId: null,
        model: null,
        possibleCauses: [],
      },
      session
    );
    await this.knowledgeService.addEvidence(
      kase.id,
      {
        sourceType: 'Inspection',
        sourceModule: 'pdi',
        sourceRecordId: inspection.id,
        machineSerial: inspection.serial,
        observedAt: new Date().toISOString().slice(0, 10),
        confidence: null,
        summary: finding.description,
      },
      session
    );

    const updatedFindings = inspection.findings.map((f) => (f.id === findingId ? { ...f, knowledgeCaseId: kase.id } : f));
    const updated = await this.repo.update(inspectionId, { findings: updatedFindings, updatedBy: session.username });
    await logAuditEvent({
      module: 'pdi',
      recordId: inspectionId,
      recordRef: updated.inspectionRef,
      eventType: 'SystemEvent',
      fieldName: 'KnowledgeCandidate',
      newValue: kase.caseRef,
      performedBy: session.username,
    });
    return updated;
  }

  /** Internal helper - fetches without re-asserting access (used by
   *  methods that already asserted at their own entry point, avoiding a
   *  redundant check inside a single call). */
  private async getInspectionUnchecked(id: string): Promise<Inspection> {
    const inspection = await this.repo.getById(id);
    if (!inspection) throw new Error(`Inspection ${id} not found`);
    return inspection;
  }
}

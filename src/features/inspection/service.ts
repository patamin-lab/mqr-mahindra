/**
 * InspectionService (ADR-017) — the one door every caller goes through for
 * PDI. Every mutating method writes to the shared `record_audit_log`
 * (module `'pdi'`) via the existing `logAuditEvent()` — no second audit
 * table, matching `KnowledgeService`'s own convention.
 */
import { logAuditEvent } from '@/lib/db';
import type { SessionUser } from '@/lib/types';
import { KnowledgeService } from '@/features/knowledge';
import { InspectionRepository, CreateInspectionInput } from './repository';
import {
  Inspection,
  InspectionType,
  ChecklistItem,
  Finding,
  Measurement,
  PartReplaced,
  DEFAULT_PDI_CHECKLIST,
  DEFAULT_PDI_CHECKLIST_VERSION,
  canDealerApproveInspection,
} from './types';

export interface CreateInspectionRequest {
  inspectionType?: InspectionType;
  vehicleId: string;
  serial: string;
  dealerId: string | null;
  technicianId: string | null;
  technicianName: string;
  technicianCertificationRef: string | null;
  relatedNtrId: string | null;
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

export class InspectionService {
  constructor(
    private readonly repo: InspectionRepository = new InspectionRepository(),
    private readonly knowledgeService: KnowledgeService = new KnowledgeService()
  ) {}

  async listInspections(filters: Parameters<InspectionRepository['list']>[0] = {}): Promise<Inspection[]> {
    return this.repo.list(filters);
  }

  async getInspection(id: string): Promise<Inspection> {
    const inspection = await this.repo.getById(id);
    if (!inspection) throw new Error(`Inspection ${id} not found`);
    return inspection;
  }

  async listInspectionsForSerial(serial: string): Promise<Inspection[]> {
    return this.repo.listForSerial(serial);
  }

  /** Creates a PDI starting from the one seeded default checklist template
   *  (ch.04's checklist-configurability question is deferred - see
   *  docs/architecture/INSPECTION_PDI.md). `status: 'Scheduled'` is the DB
   *  column default, not passed explicitly, matching Knowledge's own
   *  "exactly one place the starting state is named" convention. */
  async createInspection(input: CreateInspectionRequest, session: SessionUser): Promise<Inspection> {
    const checklist: ChecklistItem[] = DEFAULT_PDI_CHECKLIST.map((item) => ({ ...item, result: null, remark: null }));
    const created = await this.repo.create({
      inspectionType: input.inspectionType ?? 'DEALER_PDI',
      vehicleId: input.vehicleId,
      serial: input.serial,
      dealerId: input.dealerId,
      checklistVersion: DEFAULT_PDI_CHECKLIST_VERSION,
      checklist,
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      technicianCertificationRef: input.technicianCertificationRef,
      relatedNtrId: input.relatedNtrId,
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

  async updateChecklist(id: string, checklist: ChecklistItem[], session: SessionUser): Promise<Inspection> {
    const before = await this.getInspection(id);
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
    const before = await this.getInspection(id);
    const finding: Finding = { id: crypto.randomUUID(), ...input, knowledgeCaseId: null };
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

  async addMeasurement(id: string, input: AddMeasurementInput, session: SessionUser): Promise<Inspection> {
    const before = await this.getInspection(id);
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
    const before = await this.getInspection(id);
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
   *  completing — the digital equivalent of "every line item ticked"
   *  before a technician can sign off. `result: 'Fail'` on any Fail-
   *  severity item forces `Conditional`/`Fail` overall, never silently
   *  `Pass`. */
  async completeInspection(id: string, session: SessionUser): Promise<Inspection> {
    const before = await this.getInspection(id);
    const unset = before.checklist.filter((c) => c.result === null);
    if (unset.length > 0) {
      throw new Error(`Cannot complete inspection - ${unset.length} checklist item(s) have no result recorded`);
    }
    const anyFail = before.checklist.some((c) => c.result === 'Fail');
    const result = anyFail ? (before.findings.length > 0 ? 'Fail' : 'Conditional') : 'Pass';

    const updated = await this.repo.update(id, { status: 'Completed', result, updatedBy: session.username });
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
    return updated;
  }

  /** Digital Sign-off — the technician confirming the completed
   *  inspection is theirs. Open to any role that performed it; not gated
   *  like Dealer Approval below. */
  async signOff(id: string, session: SessionUser): Promise<Inspection> {
    const before = await this.getInspection(id);
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

  /** Dealer Approval — the trust-conferring action, gated by
   *  `canDealerApproveInspection` (SuperAdmin/CentralAdmin/DealerAdmin
   *  only). Server-side enforcement; nav/button visibility is UX only
   *  (`SECURITY_STANDARD.md`). */
  async dealerApprove(id: string, session: SessionUser): Promise<Inspection> {
    if (!canDealerApproveInspection(session.role)) {
      throw new Error(`Role ${session.role} may not give Dealer Approval on a PDI`);
    }
    const before = await this.getInspection(id);
    if (!before.signedOffAt) throw new Error('Cannot give Dealer Approval before Digital Sign-off');
    const updated = await this.repo.update(id, {
      dealerApprovedBy: session.username,
      dealerApprovedAt: new Date().toISOString(),
      updatedBy: session.username,
    });
    await logAuditEvent({
      module: 'pdi',
      recordId: id,
      recordRef: updated.inspectionRef,
      eventType: 'SystemEvent',
      fieldName: 'DealerApproval',
      newValue: session.username,
      performedBy: session.username,
    });
    return updated;
  }

  /** Structured Findings may become Knowledge Candidates through the
   *  existing Knowledge Platform - "do not duplicate entry" (task brief):
   *  this calls `KnowledgeService.createCandidate()`/`.addEvidence()`
   *  directly, the same public write API every other future consumer
   *  will use, then stores the resulting `knowledgeCaseId` back onto the
   *  finding. No parallel Knowledge-entry form exists anywhere in this
   *  module. `source_type: 'Inspection'` is the Knowledge Foundation
   *  Freeze's own documented Extension path (a new Evidence source type),
   *  not a violation of it. */
  async promoteFindingToKnowledge(inspectionId: string, findingId: string, session: SessionUser): Promise<Inspection> {
    const inspection = await this.getInspection(inspectionId);
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
}

/**
 * KnowledgeService (ADR-018) — the one door every caller goes through for
 * Knowledge, matching ch.07's named shape
 * (`createOrUpdateCase`/`recordFeedback`/`findSimilarCases`, renamed here
 * to this reconciled model's actual methods) and its rule: "never queried
 * directly by Engineering Intelligence/Analytics" — only this service
 * calls `KnowledgeRepository`. Every mutating method writes to the shared
 * `record_audit_log` (module `'knowledge'`) via the existing
 * `logAuditEvent()`/`diffFieldsForAudit()` — no second audit table.
 */
import { logAuditEvent, logAuditEvents, diffFieldsForAudit } from '@/lib/db';
import type { SessionUser } from '@/lib/types';
import {
  KnowledgeRepository,
  CreateKnowledgeCaseInput,
  CreateKnowledgeEvidenceInput,
} from './repository';
import {
  KnowledgeCase,
  KnowledgeCaseDetail,
  KnowledgeListFilters,
  KnowledgeMaturity,
  KnowledgeConfidenceLevel,
  KnowledgePossibleCause,
  KnowledgeVerificationStep,
  KnowledgeEvidenceSourceType,
  MachineKnownIssue,
  canTransitionKnowledgeMaturity,
} from './types';

export interface CreateCandidateInput {
  symptom: string;
  affectedSystem: string | null;
  productFamilyId: string | null;
  model: string | null;
  possibleCauses: KnowledgePossibleCause[];
}

export interface UpdateCaseInput {
  symptom?: string;
  affectedSystem?: string | null;
  productFamilyId?: string | null;
  model?: string | null;
  possibleCauses?: KnowledgePossibleCause[];
  validatedFix?: string | null;
  verificationSteps?: KnowledgeVerificationStep[];
  confidence?: KnowledgeConfidenceLevel;
}

export interface AddEvidenceInput {
  sourceType: KnowledgeEvidenceSourceType;
  sourceModule: 'mqr' | 'pm' | 'ntr' | null;
  sourceRecordId: string | null;
  machineSerial: string | null;
  observedAt: string;
  confidence: KnowledgeConfidenceLevel | null;
  summary: string;
}

const FIELD_LABELS: Record<string, string> = {
  symptom: 'Symptom',
  affectedSystem: 'AffectedSystem',
  validatedFix: 'ValidatedFix',
  confidence: 'Confidence',
};

export class KnowledgeService {
  constructor(private readonly repo: KnowledgeRepository = new KnowledgeRepository()) {}

  async listCases(filters: KnowledgeListFilters = {}): Promise<KnowledgeCase[]> {
    return this.repo.list(filters);
  }

  /** Creates a Knowledge Candidate — `maturity: 'Draft'` by default (set
   *  by the DB column default, not passed explicitly here, so there is
   *  exactly one place `'Draft'` is the starting state). Open to every
   *  role — see `canTransitionKnowledgeMaturity`'s doc comment. */
  async createCandidate(input: CreateCandidateInput, session: SessionUser): Promise<KnowledgeCase> {
    const created = await this.repo.create({
      dealerId: session.dealerId,
      symptom: input.symptom,
      affectedSystem: input.affectedSystem,
      productFamilyId: input.productFamilyId,
      model: input.model,
      possibleCauses: input.possibleCauses,
      createdBy: session.username,
    } satisfies CreateKnowledgeCaseInput);

    await logAuditEvent({
      module: 'knowledge',
      recordId: created.id,
      recordRef: created.caseRef,
      eventType: 'Created',
      performedBy: session.username,
    });
    return created;
  }

  /** Edits a case's own fields. The `PATCH /api/knowledge-cases/[id]`
   *  route rejects this once `maturity === 'Published'` unless the caller
   *  passes `canReviewKnowledge` (reuses the maturity gate, not a second
   *  lock mechanism — see the route). */
  async updateCase(id: string, input: UpdateCaseInput, session: SessionUser): Promise<KnowledgeCase> {
    const before = await this.repo.getById(id);
    if (!before) throw new Error(`Knowledge case ${id} not found`);

    const updated = await this.repo.update(id, { ...input, updatedBy: session.username });

    const events = diffFieldsForAudit(
      { module: 'knowledge', recordId: id, recordRef: updated.caseRef, performedBy: session.username },
      FIELD_LABELS,
      before as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    );
    await logAuditEvents(events);
    return updated;
  }

  /** The Engineering Review action (and every other maturity move).
   *  Server-side enforcement of `canTransitionKnowledgeMaturity` — nav/
   *  button visibility is UX only (`SECURITY_STANDARD.md`). */
  async transitionMaturity(id: string, to: KnowledgeMaturity, session: SessionUser, supersededByCaseId: string | null = null): Promise<KnowledgeCase> {
    const before = await this.repo.getById(id);
    if (!before) throw new Error(`Knowledge case ${id} not found`);
    if (!canTransitionKnowledgeMaturity(before.maturity, to, session.role)) {
      throw new Error(`Role ${session.role} may not move a Knowledge Case from ${before.maturity} to ${to}`);
    }

    const updated = await this.repo.updateMaturity(id, to, supersededByCaseId, session.username);
    await logAuditEvent({
      module: 'knowledge',
      recordId: id,
      recordRef: updated.caseRef,
      eventType: 'StatusChanged',
      fieldName: 'Maturity',
      oldValue: before.maturity,
      newValue: to,
      performedBy: session.username,
    });
    return updated;
  }

  async addEvidence(caseId: string, input: AddEvidenceInput, session: SessionUser): Promise<KnowledgeCaseDetail> {
    const kase = await this.repo.getById(caseId);
    if (!kase) throw new Error(`Knowledge case ${caseId} not found`);

    await this.repo.addEvidence({
      knowledgeCaseId: caseId,
      sourceType: input.sourceType,
      sourceModule: input.sourceModule,
      sourceRecordId: input.sourceRecordId,
      machineSerial: input.machineSerial,
      author: session.username,
      observedAt: input.observedAt,
      confidence: input.confidence,
      summary: input.summary,
      createdBy: session.username,
    } satisfies CreateKnowledgeEvidenceInput);

    await logAuditEvent({
      module: 'knowledge',
      recordId: caseId,
      recordRef: kase.caseRef,
      eventType: 'AttachmentAdded',
      fieldName: 'Evidence',
      newValue: input.summary,
      performedBy: session.username,
    });
    return this.getCase(caseId);
  }

  /** Case detail + derived Related Records — every "Related X" list comes
   *  from this case's own evidence rows, never a second query against
   *  MQR/PM/Warranty tables directly (ch.07's central rule: a case is
   *  never keyed off one module's table). `relatedQualityReports`/
   *  `relatedPm` link out using each module's own detail-route
   *  convention (MQR: `job_id`, PM: `id` — see the route builder below);
   *  `relatedWarranty` is informational (Warranty has no dedicated table
   *  of its own — `MACHINE_DATA_OWNERSHIP.md`), linking out only when the
   *  evidence also names an MQR record. */
  async getCase(id: string): Promise<KnowledgeCaseDetail> {
    const kase = await this.repo.getById(id);
    if (!kase) throw new Error(`Knowledge case ${id} not found`);
    const evidence = await this.repo.listEvidenceForCase(id);

    const relatedMachines = Array.from(new Set(evidence.map((e) => e.machineSerial).filter((s): s is string => !!s)));
    const relatedQualityReports = evidence
      .filter((e) => e.sourceModule === 'mqr' && e.sourceRecordId)
      .map((e) => ({ recordId: e.sourceRecordId as string, href: `/records/${encodeURIComponent(e.sourceRecordId as string)}` }));
    const relatedPm = evidence
      .filter((e) => e.sourceModule === 'pm' && e.sourceRecordId)
      .map((e) => ({ recordId: e.sourceRecordId as string, href: `/pm-records/${e.sourceRecordId}` }));
    const relatedWarranty = evidence
      .filter((e) => e.sourceType === 'Warranty')
      .map((e) => ({
        recordId: e.sourceRecordId ?? e.id,
        href: e.sourceModule === 'mqr' && e.sourceRecordId ? `/records/${encodeURIComponent(e.sourceRecordId)}` : `#evidence-${e.id}`,
      }));

    return { case: kase, evidence, relatedMachines, relatedQualityReports, relatedPm, relatedWarranty };
  }

  /** The one method Machine calls (`MachineService.getMachineKnowledgeSummary()`)
   *  — Published cases only, since a technician-facing "Known Issue" must
   *  be validated, never a raw Candidate. Machine never queries
   *  `knowledge_cases`/`knowledge_evidence` directly. */
  async getKnowledgeForMachine(serial: string): Promise<MachineKnownIssue[]> {
    const cases = await this.repo.listPublishedCasesForMachineSerial(serial);
    return cases.map((c) => ({
      caseId: c.id,
      caseRef: c.caseRef,
      symptom: c.symptom,
      confidence: c.confidence,
      validatedFix: c.validatedFix,
      href: `/quality/knowledge/${c.id}`,
    }));
  }
}

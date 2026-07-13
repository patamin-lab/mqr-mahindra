/**
 * KnowledgeRepository — owns `knowledge_cases` and `knowledge_evidence`
 * (ADR-018). One repository for one aggregate (a case and its evidence),
 * matching ch.07's explicit shape: "never queried directly by Engineering
 * Intelligence/Analytics" — only `KnowledgeService` calls this class.
 * Reuses the existing server-only Supabase client (`@/lib/supabase`, the
 * same pattern every other repository in this app uses) — no second
 * connection, no ORM.
 */
import { getSupabase } from '@/lib/supabase';
import type {
  KnowledgeCase,
  KnowledgeEvidence,
  KnowledgeListFilters,
  KnowledgeConfidenceLevel,
  KnowledgeMaturity,
  KnowledgePossibleCause,
  KnowledgeVerificationStep,
  KnowledgeEvidenceSourceType,
} from './types';

const CASES_TABLE = 'knowledge_cases';
const EVIDENCE_TABLE = 'knowledge_evidence';

function mapCaseRow(row: any): KnowledgeCase {
  return {
    id: row.id,
    caseRef: row.case_ref,
    dealerId: row.dealer_id,
    symptom: row.symptom,
    affectedSystem: row.affected_system,
    productFamilyId: row.product_family_id,
    model: row.model,
    possibleCauses: (row.possible_causes ?? []) as KnowledgePossibleCause[],
    validatedFix: row.validated_fix,
    verificationSteps: (row.verification_steps ?? []) as KnowledgeVerificationStep[],
    confidence: row.confidence as KnowledgeConfidenceLevel,
    maturity: row.maturity as KnowledgeMaturity,
    supersededByCaseId: row.superseded_by_case_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    recordStatus: row.record_status,
  };
}

function mapEvidenceRow(row: any): KnowledgeEvidence {
  return {
    id: row.id,
    knowledgeCaseId: row.knowledge_case_id,
    sourceType: row.source_type as KnowledgeEvidenceSourceType,
    sourceModule: row.source_module,
    sourceRecordId: row.source_record_id,
    machineSerial: row.machine_serial,
    author: row.author,
    observedAt: row.observed_at,
    confidence: row.confidence,
    summary: row.summary,
    createdBy: row.created_by,
    createdAt: row.created_at,
    recordStatus: row.record_status,
  };
}

export interface CreateKnowledgeCaseInput {
  dealerId: string | null;
  symptom: string;
  affectedSystem: string | null;
  productFamilyId: string | null;
  model: string | null;
  possibleCauses: KnowledgePossibleCause[];
  createdBy: string;
}

export interface UpdateKnowledgeCaseInput {
  symptom?: string;
  affectedSystem?: string | null;
  productFamilyId?: string | null;
  model?: string | null;
  possibleCauses?: KnowledgePossibleCause[];
  validatedFix?: string | null;
  verificationSteps?: KnowledgeVerificationStep[];
  confidence?: KnowledgeConfidenceLevel;
  updatedBy: string;
}

export interface CreateKnowledgeEvidenceInput {
  knowledgeCaseId: string;
  sourceType: KnowledgeEvidenceSourceType;
  sourceModule: 'mqr' | 'pm' | 'ntr' | null;
  sourceRecordId: string | null;
  machineSerial: string | null;
  author: string;
  observedAt: string;
  confidence: KnowledgeConfidenceLevel | null;
  summary: string;
  createdBy: string;
}

export class KnowledgeRepository {
  /** Lazy, not a field initializer - `getSupabase()` throws if the env
   *  vars aren't set, and a field initializer would run at construction
   *  time (e.g. `new KnowledgeService()` as a default constructor param
   *  elsewhere), before a test ever gets a chance to mock `@/lib/supabase`.
   *  Matches `AttachmentRepository`'s existing per-call `getSupabase()`
   *  pattern, not a repository-local eager client. */
  private get client() {
    return getSupabase();
  }

  /** Business-facing case reference: `KNOW-<year>-######`. Reuses the
   *  existing `next_job_seq()` RPC (same atomic per-bucket counter MQR's
   *  `nextJobId()`/PM's `nextPmNumber()` use) with a fixed global bucket
   *  key (`'KNOW:GLOBAL'`), not a per-dealer one — a deliberate deviation
   *  from `DATABASE_STANDARD.md`'s per-dealer bucket convention, because
   *  Knowledge is platform-shared reference data, not a dealer-owned
   *  transactional record (see KNOWLEDGE_PLATFORM.md §9). */
  private async nextCaseRef(): Promise<string> {
    const year = String(new Date().getFullYear());
    const { data, error } = await this.client.rpc('next_job_seq', {
      p_dealer_id: 'KNOW:GLOBAL',
      p_year: year,
    });
    if (error) throw error;
    const seq = Number(data);
    return `KNOW-${year}-${String(seq).padStart(6, '0')}`;
  }

  async list(filters: KnowledgeListFilters = {}): Promise<KnowledgeCase[]> {
    let query = this.client.from(CASES_TABLE).select('*').eq('record_status', 'Active').order('created_at', { ascending: false });
    if (filters.maturity) query = query.eq('maturity', filters.maturity);
    if (filters.productFamilyId) query = query.eq('product_family_id', filters.productFamilyId);
    if (filters.q) query = query.or(`symptom.ilike.%${filters.q}%,case_ref.ilike.%${filters.q}%,affected_system.ilike.%${filters.q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapCaseRow);
  }

  async getById(id: string): Promise<KnowledgeCase | null> {
    const { data, error } = await this.client.from(CASES_TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data || data.record_status === 'Deleted') return null;
    return mapCaseRow(data);
  }

  async create(input: CreateKnowledgeCaseInput): Promise<KnowledgeCase> {
    const caseRef = await this.nextCaseRef();
    const { data, error } = await this.client
      .from(CASES_TABLE)
      .insert({
        case_ref: caseRef,
        dealer_id: input.dealerId,
        symptom: input.symptom,
        affected_system: input.affectedSystem,
        product_family_id: input.productFamilyId,
        model: input.model,
        possible_causes: input.possibleCauses,
        created_by: input.createdBy,
        updated_by: input.createdBy,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapCaseRow(data);
  }

  async update(id: string, input: UpdateKnowledgeCaseInput): Promise<KnowledgeCase> {
    const patch: Record<string, unknown> = { updated_by: input.updatedBy, updated_at: new Date().toISOString() };
    if (input.symptom !== undefined) patch.symptom = input.symptom;
    if (input.affectedSystem !== undefined) patch.affected_system = input.affectedSystem;
    if (input.productFamilyId !== undefined) patch.product_family_id = input.productFamilyId;
    if (input.model !== undefined) patch.model = input.model;
    if (input.possibleCauses !== undefined) patch.possible_causes = input.possibleCauses;
    if (input.validatedFix !== undefined) patch.validated_fix = input.validatedFix;
    if (input.verificationSteps !== undefined) patch.verification_steps = input.verificationSteps;
    if (input.confidence !== undefined) patch.confidence = input.confidence;

    const { data, error } = await this.client.from(CASES_TABLE).update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return mapCaseRow(data);
  }

  async updateMaturity(id: string, maturity: KnowledgeMaturity, supersededByCaseId: string | null, updatedBy: string): Promise<KnowledgeCase> {
    const { data, error } = await this.client
      .from(CASES_TABLE)
      .update({ maturity, superseded_by_case_id: supersededByCaseId, updated_by: updatedBy, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapCaseRow(data);
  }

  async listEvidenceForCase(knowledgeCaseId: string): Promise<KnowledgeEvidence[]> {
    const { data, error } = await this.client
      .from(EVIDENCE_TABLE)
      .select('*')
      .eq('knowledge_case_id', knowledgeCaseId)
      .eq('record_status', 'Active')
      .order('observed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapEvidenceRow);
  }

  async addEvidence(input: CreateKnowledgeEvidenceInput): Promise<KnowledgeEvidence> {
    const { data, error } = await this.client
      .from(EVIDENCE_TABLE)
      .insert({
        knowledge_case_id: input.knowledgeCaseId,
        source_type: input.sourceType,
        source_module: input.sourceModule,
        source_record_id: input.sourceRecordId,
        machine_serial: input.machineSerial,
        author: input.author,
        observed_at: input.observedAt,
        confidence: input.confidence,
        summary: input.summary,
        created_by: input.createdBy,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapEvidenceRow(data);
  }

  /** Machine Passport's reverse lookup — every Published case whose
   *  evidence names this serial. Two queries (evidence-by-serial, then
   *  cases-by-id), never a join back through MQR/PM/NTR — matches ch.07's
   *  rule that a case is never keyed off one machine. */
  async listPublishedCasesForMachineSerial(serial: string): Promise<KnowledgeCase[]> {
    const { data: evidenceRows, error: evidenceError } = await this.client
      .from(EVIDENCE_TABLE)
      .select('knowledge_case_id')
      .eq('machine_serial', serial)
      .eq('record_status', 'Active');
    if (evidenceError) throw evidenceError;
    const caseIds = Array.from(new Set((evidenceRows ?? []).map((r: any) => r.knowledge_case_id as string)));
    if (caseIds.length === 0) return [];

    const { data: caseRows, error: caseError } = await this.client
      .from(CASES_TABLE)
      .select('*')
      .in('id', caseIds)
      .eq('maturity', 'Published')
      .eq('record_status', 'Active')
      .order('updated_at', { ascending: false });
    if (caseError) throw caseError;
    return (caseRows ?? []).map(mapCaseRow);
  }
}

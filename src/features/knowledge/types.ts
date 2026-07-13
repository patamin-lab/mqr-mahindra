/**
 * Engineering Knowledge Platform (ADR-018, refines Blueprint ch.07) —
 * domain types. One aggregate: `KnowledgeCase` (a "Knowledge Candidate"
 * and a "Knowledge Case" are the SAME row — those are UI-facing names for
 * a maturity bucket, never two tables/types) plus its child evidence
 * rows. See `docs/architecture/KNOWLEDGE_PLATFORM.md`.
 */
import type { Role } from '@/lib/types';
import { canReviewKnowledge } from '@/lib/scope';

/** Confidence = evidence quality, set manually only — AI must never
 *  assign this (see KNOWLEDGE_PLATFORM.md §5). Independent of `maturity`
 *  (workflow state) — a Draft case can already be `High` confidence if
 *  the evidence is strong; a Published case is not automatically
 *  `Verified`. */
export type KnowledgeConfidenceLevel = 'VeryLow' | 'Low' | 'Medium' | 'High' | 'Verified';

export const KNOWLEDGE_CONFIDENCE_LEVELS: KnowledgeConfidenceLevel[] = ['VeryLow', 'Low', 'Medium', 'High', 'Verified'];

/** Maturity = workflow state. "Candidate" (UI term) = `Draft`/`Review`;
 *  "Case" (UI term) = `Published`/`Deprecated`/`Archived`. Engineering
 *  Review is the `Review` → `Published` transition, gated by
 *  `canReviewKnowledge` (`lib/scope.ts`), not a second storage model. */
export type KnowledgeMaturity = 'Draft' | 'Review' | 'Published' | 'Deprecated' | 'Archived';

export const KNOWLEDGE_MATURITY_VALUES: KnowledgeMaturity[] = ['Draft', 'Review', 'Published', 'Deprecated', 'Archived'];

/** Allowed forward transitions. Mirrors `MQR_STATUS_TRANSITIONS` in
 *  `lib/types.ts` exactly — same shape, same "same-state is always a
 *  no-op" and "SuperAdmin unconditional override" rules in
 *  `canTransitionKnowledgeMaturity` below. */
export const KNOWLEDGE_MATURITY_TRANSITIONS: Record<KnowledgeMaturity, KnowledgeMaturity[]> = {
  Draft: ['Review'],
  Review: ['Draft', 'Published'],
  Published: ['Deprecated', 'Archived'],
  Deprecated: ['Archived'],
  Archived: [],
};

/** Whether `role` may move a Knowledge Case's maturity from `from` to
 *  `to`. The trust-conferring transitions (into Published/Deprecated/
 *  Archived — i.e. Engineering Review and retirement) require
 *  `canReviewKnowledge` (`lib/scope.ts`'s `seesAllDealers` boundary);
 *  every other transition (submitting a Candidate for review, sending it
 *  back to Draft) is open to any role, matching ch.07's "everyone who
 *  touches a Machine improves Knowledge." SuperAdmin gets the same
 *  unconditional override `canTransitionMqrStatus` grants. */
export function canTransitionKnowledgeMaturity(from: KnowledgeMaturity, to: KnowledgeMaturity, role: Role): boolean {
  if (from === to) return true;
  if (role === 'SuperAdmin') return true;
  const structurallyAllowed = KNOWLEDGE_MATURITY_TRANSITIONS[from]?.includes(to) ?? false;
  if (!structurallyAllowed) return false;
  if (to === 'Published' || to === 'Deprecated' || to === 'Archived') return canReviewKnowledge(role);
  return true;
}

export interface KnowledgePossibleCause {
  cause: string;
}

export interface KnowledgeVerificationStep {
  step: string;
}

export interface KnowledgeCase {
  id: string;
  caseRef: string;
  dealerId: string | null;
  symptom: string;
  affectedSystem: string | null;
  productFamilyId: string | null;
  model: string | null;
  possibleCauses: KnowledgePossibleCause[];
  validatedFix: string | null;
  verificationSteps: KnowledgeVerificationStep[];
  confidence: KnowledgeConfidenceLevel;
  maturity: KnowledgeMaturity;
  supersededByCaseId: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  recordStatus: 'Active' | 'Deleted';
}

/** Evidence source vocabulary (task spec, verbatim) — 'IoT' is accepted
 *  by the DB CHECK constraint and reserved for a future producer; no
 *  code path creates it yet (Explicitly deferred, see KNOWLEDGE_PLATFORM.md).
 *  'Inspection' (ADR-017/ADR-027, Machine Delivery Platform) was added
 *  later — the Knowledge Foundation Freeze v1.0 names "adding a new
 *  Evidence source type" as compliant Extension, not a violation (see
 *  docs/releases/KNOWLEDGE_FOUNDATION_FREEZE_v1.0.md). */
export type KnowledgeEvidenceSourceType = 'Quality' | 'PM' | 'Warranty' | 'Machine' | 'Dealer' | 'Customer' | 'Engineer' | 'IoT' | 'Inspection';

export interface KnowledgeEvidence {
  id: string;
  knowledgeCaseId: string;
  sourceType: KnowledgeEvidenceSourceType;
  /** When this evidence links to a real existing MQR/PM/NTR/PDI record —
   *  optional, since Dealer/Customer/Engineer evidence may be a free-text
   *  observation with no specific record behind it. */
  sourceModule: 'mqr' | 'pm' | 'ntr' | 'pdi' | null;
  sourceRecordId: string | null;
  /** Denormalized on purpose (not derived via a join back through
   *  MQR/PM/NTR) — this is how "Related Machines" and the Machine
   *  Passport's reverse lookup work with zero coupling from
   *  `knowledge_cases` to any one module's table (ch.07's central rule). */
  machineSerial: string | null;
  author: string;
  observedAt: string;
  confidence: KnowledgeConfidenceLevel | null;
  summary: string;
  createdBy: string;
  createdAt: string;
  recordStatus: 'Active' | 'Deleted';
}

/** Case detail + everything a Screen Contract "Related Records" section
 *  needs — all derived from this case's own evidence rows, never a
 *  second query against MQR/PM/Warranty tables directly. */
export interface KnowledgeCaseDetail {
  case: KnowledgeCase;
  evidence: KnowledgeEvidence[];
  relatedMachines: string[];
  relatedQualityReports: { recordId: string; href: string }[];
  relatedPm: { recordId: string; href: string }[];
  relatedWarranty: { recordId: string; href: string }[];
}

export interface KnowledgeListFilters {
  maturity?: KnowledgeMaturity;
  q?: string;
  productFamilyId?: string;
}

/** Machine Passport's Knowledge section (`MachineService.getMachineKnowledgeSummary()`)
 *  — Published cases only, since a technician-facing "Known Issue" must
 *  be validated, never a raw, unreviewed Candidate. */
export interface MachineKnownIssue {
  caseId: string;
  caseRef: string;
  symptom: string;
  confidence: KnowledgeConfidenceLevel;
  validatedFix: string | null;
  href: string;
}

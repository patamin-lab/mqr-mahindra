/**
 * Import Inspection Domain (ADR-017, refines Blueprint ch.04) — domain
 * types. One aggregate: `Inspection` (the `inspections` table).
 *
 * **Business-domain correction** (architecture-review pass, corrects the
 * original ADR-017/ADR-027 build): Import Inspection (MSEAL PDI) is an
 * internal MSEAL quality process performed by MSEAL technicians BEFORE a
 * machine is released to a dealer - it is not "Dealer PDI," it is never
 * dealer-visible (`lib/scope.ts`'s `canAccessImportInspection`), and it
 * is never linked to an NTR record (NTR is the ownership-transfer event
 * that happens at the dealer, after Release to Dealer - see
 * docs/architecture/DELIVERY_PLATFORM.md's corrected Business Process).
 * "PDI" is one inspection event; a machine may have several
 * (`PDI` -> `RE_PDI` -> `RE_PDI` -> ...), each immutable, chained via
 * `previousInspectionId`, never overwritten.
 */
import type { Severity } from '@/lib/types';

/** Structural: is this the first inspection event for this machine, or a
 *  repeat. Not "Dealer PDI vs Import PDI" - there is no Dealer PDI in the
 *  corrected model; every inspection here is an Import Inspection. */
export type InspectionType = 'PDI' | 'RE_PDI';

/** Business reason a particular inspection event happened - independent
 *  of `InspectionType` (a RE_PDI can happen for any of these reasons). */
export type InspectionReason = 'INITIAL' | 'STORAGE_EXPIRED' | 'REPAIR_VERIFICATION' | 'FACTORY_REQUEST' | 'OTHER';

export type InspectionStatus = 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';

export type InspectionResult = 'Pass' | 'Fail' | 'Conditional';

/** The actual lifecycle/workflow state - independent of `result` (a
 *  Passed inspection can still be `Pending` release, or `Expired` if
 *  Release to Dealer never happened within the configurable expiration
 *  window). `RequiresRePdi` covers both a Failed inspection and an
 *  Expired-then-superseded one. */
export type ReleaseStatus = 'Pending' | 'ReleasedToDealer' | 'RequiresRePdi' | 'Expired';

export interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  result: 'Pass' | 'Fail' | 'NA' | null;
  remark: string | null;
}

/** One seeded default template (ch.04's own open question — "are checklist
 *  templates dealer/product-family-configurable?" — is left unresolved;
 *  a configurable template builder is explicitly deferred). Every new
 *  Inspection starts from this list, editable per-inspection afterward. */
export const DEFAULT_PDI_CHECKLIST_VERSION = 'PDI-CL-v1';

export const DEFAULT_PDI_CHECKLIST: Omit<ChecklistItem, 'result' | 'remark'>[] = [
  { id: 'engine-oil', category: 'Engine', label: 'Engine oil level and condition' },
  { id: 'coolant', category: 'Engine', label: 'Coolant level and leaks' },
  { id: 'battery', category: 'Electrical', label: 'Battery charge and terminals' },
  { id: 'lights', category: 'Electrical', label: 'All lights and indicators functional' },
  { id: 'tires', category: 'Chassis', label: 'Tire pressure and condition' },
  { id: 'hydraulics', category: 'Hydraulics', label: 'Hydraulic system leaks and operation' },
  { id: 'brakes', category: 'Chassis', label: 'Brake operation and fluid level' },
  { id: 'pto', category: 'Drivetrain', label: 'PTO engagement and operation' },
  { id: 'attachments-fit', category: 'Attachments', label: 'Implements/attachments fit and function' },
  { id: 'documentation', category: 'Documentation', label: 'Owner’s manual and documents present' },
];

/** Inspection expiration period - configurable (a single named constant,
 *  not a settings screen; this is not a UI redesign). Default 180 days:
 *  once an inspection Passes, it remains valid for this many days before
 *  requiring a RE-PDI ahead of Release to Dealer. */
export const INSPECTION_EXPIRATION_DAYS = 180;

export function computeNextRePdiDueDate(inspectionDate: string, expirationDays: number = INSPECTION_EXPIRATION_DAYS): string {
  const due = new Date(inspectionDate);
  due.setDate(due.getDate() + expirationDays);
  return due.toISOString().slice(0, 10);
}

export function isInspectionExpired(inspection: Pick<Inspection, 'releaseStatus' | 'nextRePdiDueDate'>, today: string = new Date().toISOString().slice(0, 10)): boolean {
  if (inspection.releaseStatus === 'ReleasedToDealer') return false;
  if (!inspection.nextRePdiDueDate) return false;
  return inspection.nextRePdiDueDate < today;
}

/** Disposition of a finding - MSEAL's own engineering judgment on it,
 *  independent of whether Factory Feedback has been sent yet. */
export type FindingDisposition = 'PendingReview' | 'Accepted' | 'Rejected' | 'Resolved';

/** Factory Feedback Model (first-class, per-finding): a finding may be
 *  escalated to the factory/supplier; this tracks that communication's
 *  own state, distinct from the finding's engineering disposition.
 *  Designed to remain extensible toward a future Supplier Quality
 *  integration (`correctiveActionReference` is a free-text pointer today
 *  - a real 8D/CAPA reference number, once such a system exists to
 *  reference - not a fabricated FK to a system that doesn't exist yet). */
export type FactoryFeedbackStatus = 'NotSent' | 'Sent' | 'Acknowledged' | 'ActionTaken';

/** Severity reuses the platform's existing `Severity` type (`lib/types.ts`)
 *  — no second severity vocabulary for Import Inspection findings. */
export interface Finding {
  id: string;
  severity: Severity;
  system: string;
  description: string;
  disposition: FindingDisposition;
  factoryFeedbackStatus: FactoryFeedbackStatus;
  correctiveActionReference: string | null;
  /** Set once a finding is promoted to a Knowledge Candidate
   *  (`InspectionService.promoteFindingToKnowledge`) — never entered by
   *  hand, never a second Knowledge-entry form. */
  knowledgeCaseId: string | null;
}

export interface Measurement {
  id: string;
  parameter: string;
  value: number;
  unit: string;
  specMin: number | null;
  specMax: number | null;
  inRange: boolean | null;
}

export interface PartReplaced {
  id: string;
  partName: string;
  partNumber: string | null;
  qty: number;
  reason: string;
}

/**
 * Inspection records own only inspection information. Machine identity
 * (Serial Number, Engine Number, Model, Variant, Manufacturing Year)
 * comes exclusively from Machine Registry (`vehicles`, via `vehicleId`) -
 * `serial` here is a denormalized reverse-lookup convenience only (same
 * convention as `knowledge_evidence.machine_serial`), never a second
 * source of machine identity.
 */
export interface Inspection {
  id: string;
  inspectionRef: string;
  inspectionType: InspectionType;
  inspectionReason: InspectionReason;
  inspectionSequence: number;
  previousInspectionId: string | null;
  /** Machine Registry reference only - see the module doc comment. */
  vehicleId: string;
  serial: string;
  dealerId: string | null;
  status: InspectionStatus;
  result: InspectionResult | null;
  releaseStatus: ReleaseStatus;
  nextRePdiDueDate: string | null;
  checklistVersion: string;
  checklist: ChecklistItem[];
  findings: Finding[];
  measurements: Measurement[];
  partsReplaced: PartReplaced[];
  factoryFeedback: string | null;
  technicianId: string | null;
  technicianName: string;
  technicianCertificationRef: string | null;
  signedOffBy: string | null;
  signedOffAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  recordStatus: 'Active' | 'Deleted';
}

export interface InspectionListFilters {
  status?: InspectionStatus;
  releaseStatus?: ReleaseStatus;
  dealerId?: string;
  serial?: string;
  q?: string;
}

/** Import Inspection Dashboard - official KPI set (business-domain
 *  correction). Every field here is real and live-computed from
 *  `inspections` alone. `findingsByModel`/`findingsByFactory` are `null`
 *  - never a fabricated placeholder - because neither has a data model
 *  yet: an Inspection carries no denormalized machine model, and no
 *  factory/supplier identity field exists anywhere in this schema
 *  (`factoryFeedback` is free-text correspondence, not an identifier) -
 *  see the Screen Contract's "Reserved for Future Capability" section. */
export interface InspectionDashboardStats {
  pendingImportInspection: number;
  pendingRePdi: number;
  /** Live-computed via `isInspectionExpired()`, never a stored/stale flag. */
  expiredInspection: number;
  releasedToDealer: number;
  criticalFindings: number;
  /** Reserved for Future Capability - no denormalized model field on Inspection. */
  findingsByModel: null;
  /** Reserved for Future Capability - no factory/supplier identity field exists. */
  findingsByFactory: null;
  factoryFeedbackPending: number;
  /** Average hours from `createdAt` to `updatedAt` across Completed
   *  inspections - an approximation (no distinct started-at/completed-at
   *  timestamp pair is stored), documented as such, not a precise duration. */
  averageInspectionHours: number | null;
  inspectionPassRate: number | null;
}

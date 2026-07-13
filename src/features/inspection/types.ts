/**
 * Inspection Domain (ADR-017, refines Blueprint ch.04) — domain types.
 * One aggregate: `Inspection` (the `inspections` table, exactly the name
 * ch.04/ADR-017's reservation named). `inspection_type` distinguishes
 * `DEALER_PDI` (this epoch's only targeted UI) from `IMPORT_PDI` (schema
 * accepts it, no manufacturer-side screen exists yet — see
 * docs/architecture/INSPECTION_PDI.md's Explicitly Deferred section).
 */
import type { Role, Severity } from '@/lib/types';
import { canApproveDelivery } from '@/lib/scope';

export type InspectionType = 'DEALER_PDI' | 'IMPORT_PDI';

export type InspectionStatus = 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';

export type InspectionResult = 'Pass' | 'Fail' | 'Conditional';

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

/** Severity reuses the platform's existing `Severity` type (`lib/types.ts`)
 *  — no second severity vocabulary for PDI findings. */
export interface Finding {
  id: string;
  severity: Severity;
  system: string;
  description: string;
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

export interface Inspection {
  id: string;
  inspectionRef: string;
  inspectionType: InspectionType;
  vehicleId: string;
  serial: string;
  dealerId: string | null;
  status: InspectionStatus;
  result: InspectionResult | null;
  checklistVersion: string;
  checklist: ChecklistItem[];
  findings: Finding[];
  measurements: Measurement[];
  partsReplaced: PartReplaced[];
  technicianId: string | null;
  technicianName: string;
  technicianCertificationRef: string | null;
  signedOffBy: string | null;
  signedOffAt: string | null;
  dealerApprovedBy: string | null;
  dealerApprovedAt: string | null;
  relatedNtrId: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  recordStatus: 'Active' | 'Deleted';
}

export interface InspectionListFilters {
  status?: InspectionStatus;
  dealerId?: string;
  serial?: string;
  q?: string;
}

/** Sign-off (technician) is open to whoever performed the inspection —
 *  Dealer Approval is the trust-conferring action, gated the same way
 *  Knowledge's `canReviewKnowledge` gates Engineering Review (see
 *  `canApproveDelivery`'s own doc comment, `lib/scope.ts`). */
export function canDealerApproveInspection(role: Role): boolean {
  return canApproveDelivery(role);
}

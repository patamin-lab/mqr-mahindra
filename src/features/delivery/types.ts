/**
 * Machine Delivery Platform (ADR-027) — domain types. `DeliveryRecord` is
 * the lifecycle-tracking aggregate that orchestrates Tractor In (read from
 * `vehicles`, never duplicated), Stock Yard, PDI (links to an
 * `Inspection`, ADR-017), Dealer Preparation, Customer Delivery (links to
 * an `NtrRecord`, never duplicated), Operator Training (owns
 * `DeliveryTraining`), Delivery Acceptance, and Warranty Activation - one
 * point-in-time event, not a claims/policy ledger. See
 * docs/architecture/DELIVERY_PLATFORM.md.
 */
export type DeliveryStage =
  | 'TractorIn'
  | 'StockYard'
  | 'PDI'
  | 'DealerPreparation'
  | 'CustomerDelivery'
  | 'OperatorTraining'
  | 'DeliveryAcceptance'
  | 'WarrantyActivation'
  | 'Completed';

/** Order of the lifecycle, task brief's own numbered list, verbatim -
 *  used to render a stage tracker and to compute "how far along" a
 *  delivery is for the Dashboard's Pending-X counts. */
export const DELIVERY_STAGE_ORDER: DeliveryStage[] = [
  'TractorIn',
  'StockYard',
  'PDI',
  'DealerPreparation',
  'CustomerDelivery',
  'OperatorTraining',
  'DeliveryAcceptance',
  'WarrantyActivation',
  'Completed',
];

export type DeliveryOverallStatus = 'InProgress' | 'Completed' | 'OnHold' | 'Cancelled';

export type WarrantyActivationSource = 'DeliveryAcceptance' | 'Manual';

export interface DeliveryRecord {
  id: string;
  deliveryRef: string;
  vehicleId: string;
  serial: string;
  dealerId: string | null;
  stage: DeliveryStage;
  stockYardReceivedAt: string | null;
  stockYardLocation: string | null;
  pdiInspectionId: string | null;
  dealerPreparationCompletedAt: string | null;
  dealerPreparationNotes: string | null;
  ntrId: string | null;
  trainingId: string | null;
  acceptanceSignedAt: string | null;
  acceptanceSignedBy: string | null;
  acceptanceNotes: string | null;
  warrantyActivatedAt: string | null;
  warrantyActivationSource: WarrantyActivationSource | null;
  overallStatus: DeliveryOverallStatus;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  recordStatus: 'Active' | 'Deleted';
}

export interface TrainingTopic {
  topic: string;
  covered: boolean;
}

export interface DeliveryTraining {
  id: string;
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
  createdAt: string;
  recordStatus: 'Active' | 'Deleted';
}

export interface DeliveryListFilters {
  stage?: DeliveryStage;
  dealerId?: string;
  serial?: string;
  q?: string;
}

/** Machine Passport's Delivery section - read-only summary, never a
 *  second Delivery table. `null` when this machine has no delivery record
 *  yet (still in dealer stock, no Tractor In record started). */
export interface MachineDeliverySummary {
  deliveryRef: string;
  stage: DeliveryStage;
  overallStatus: DeliveryOverallStatus;
  pdiResult: string | null;
  ntrId: string | null;
  trainingCompleted: boolean;
  warrantyActivatedAt: string | null;
  href: string;
}

export interface DeliveryDashboardStats {
  pendingDelivery: number;
  pendingPdi: number;
  pendingTraining: number;
  warrantyPending: number;
  deliveryQualityPassRate: number | null;
  dealerRanking: { key: string; label: string; count: number }[];
  technicianRanking: { key: string; label: string; count: number }[];
}

export interface DeliveryReportFilters {
  dealerId?: string;
  technicianName?: string;
  model?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** One consolidated dataset satisfying all 7 named "report types" (Dealer/
 *  Technician/Model/Checklist Version/Delivery Duration/Training
 *  Completion/Warranty Activation) as filters/columns of one report, not
 *  7 separate report pipelines - Reuse-before-Build. */
export interface DeliveryReportRow {
  deliveryRef: string;
  serial: string;
  model: string | null;
  dealerId: string | null;
  technicianName: string | null;
  checklistVersion: string | null;
  pdiResult: string | null;
  deliveryDurationDays: number | null;
  trainingCompleted: boolean;
  warrantyActivated: boolean;
  stage: DeliveryStage;
}

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

/** Warranty must never be activated manually (business-domain correction) -
 *  NTR is the sole ownership-transfer event and the sole legitimate
 *  trigger. `'DeliveryAcceptance'` is removed - Delivery Acceptance no
 *  longer auto-activates Warranty (see `DeliveryService.recordAcceptance`/
 *  `activateWarrantyFromNtr`). */
export type WarrantyActivationSource = 'NTR';

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
 *  yet (still in dealer stock, no Tractor In record started). `id` links
 *  out to the full Delivery Record detail (`/delivery/records/[id]`). */
export interface MachineDeliverySummary {
  id: string;
  deliveryRef: string;
  stage: DeliveryStage;
  overallStatus: DeliveryOverallStatus;
  pdiResult: string | null;
  ntrId: string | null;
  trainingCompleted: boolean;
  warrantyActivatedAt: string | null;
}

/** Official KPI set (Machine Delivery Dashboard Screen Contract, see
 *  docs/architecture/DELIVERY_PLATFORM.md §8). Every field here is a
 *  real, live-computed number - never a placeholder. Two of the ten
 *  officially named KPIs (Open Delivery Findings, Dealer Delivery SLA)
 *  have no field here at all, rather than a fake/zeroed one, because
 *  neither has a defined data model yet (Findings have no "resolved"
 *  state; no SLA threshold is configured anywhere) - see the Screen
 *  Contract's "Reserved for Future Capability" section for what each
 *  would require. Dealer/Technician Ranking are additional, non-
 *  contractual context carried over from the original Dashboard build -
 *  not part of the official ten. */
export interface DeliveryDashboardStats {
  /** Vehicles synced via Tractor In (ADR-012) with no Delivery record
   *  yet - the Delivery lifecycle hasn't started tracking them. */
  pendingTractorIn: number;
  /** Delivery records still at the `TractorIn` stage - not yet received
   *  at Stock Yard. */
  pendingStockYard: number;
  /** Delivery records at the `StockYard` stage - received, PDI not yet
   *  linked/started. */
  pendingPdi: number;
  /** Every delivery record not yet `Completed` - the overall pipeline
   *  count. */
  pendingDelivery: number;
  /** Delivery records at the `OperatorTraining` stage. */
  pendingTraining: number;
  /** Delivery records at the `WarrantyActivation` stage - Delivery
   *  Acceptance recorded, warranty not yet activated. */
  warrantyWaiting: number;
  /** Pass rate among completed PDI Inspections with a result. This
   *  platform's Inspection model has no re-inspection/retry state
   *  (Explicitly Deferred) - every completed inspection's result is its
   *  first and only one, so this is definitionally the first-pass rate,
   *  not a distinct metric from an overall pass rate. */
  pdiFirstPassRate: number | null;
  /** Average days from delivery-record creation (Tractor In) to Warranty
   *  Activation, across records that have activated. `null` when no
   *  record has activated yet - never a fabricated 0. */
  averageDeliveryLeadTimeDays: number | null;
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

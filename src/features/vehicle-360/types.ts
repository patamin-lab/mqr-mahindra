/**
 * Vehicle 360 / Vehicle Life Cycle — shared types.
 *
 * The Vehicle Life Cycle timeline is an aggregator, not a data owner: it
 * never stores its own copy of a module's records. Each module exposes a
 * `VehicleEventSource` function that reads its own table and maps rows to
 * the common `VehicleEvent` shape; the registry in `registry.ts` is the only
 * place a future module (PDI/NTR/Campaign/Parts Request/...) needs to touch
 * to appear on the timeline — the aggregation/rendering code never changes.
 */
import { SessionUser } from '@/lib/types';

/** Full set of event types the timeline is designed to render, including
 *  future modules that don't exist yet (per spec's "Future Ready" — the
 *  type/icon/label mapping is ready even though only Maintenance/MQR
 *  currently produce real events; see registry.ts). */
export type VehicleEventType =
  | 'FactoryBuild'
  | 'DealerReceive'
  | 'PdiCompleted'
  | 'NtrCompleted'
  | 'MaintenanceCompleted'
  | 'MqrOpened'
  | 'MqrClosed'
  | 'CampaignAssigned'
  | 'CampaignCompleted'
  | 'PartsRequested'
  | 'PartsDelivered'
  | 'Inspection'
  | 'Other';

export const VEHICLE_EVENT_MODULE_LABEL: Record<VehicleEventType, string> = {
  FactoryBuild: 'โรงงาน',
  DealerReceive: 'ดีลเลอร์รับรถ',
  PdiCompleted: 'PDI',
  NtrCompleted: 'NTR',
  MaintenanceCompleted: 'บำรุงรักษา (Maintenance)',
  MqrOpened: 'รายงานปัญหาคุณภาพ (MQR)',
  MqrClosed: 'รายงานปัญหาคุณภาพ (MQR)',
  CampaignAssigned: 'แคมเปญ',
  CampaignCompleted: 'แคมเปญ',
  PartsRequested: 'คำขออะไหล่',
  PartsDelivered: 'คำขออะไหล่',
  Inspection: 'ตรวจสภาพ',
  Other: 'อื่นๆ',
};

/** One row on the Vehicle Life Cycle timeline. `date` is an ISO date/timestamp
 *  string so events from different modules sort correctly together. */
export interface VehicleEvent {
  type: VehicleEventType;
  date: string;
  referenceNumber: string;
  description: string;
  user: string | null;
  status: string | null;
  /** Link back to the originating module's own detail page — the timeline
   *  never renders module data inline beyond this summary row. */
  href: string;
}

/** Contract every module implements to appear on the Vehicle Life Cycle
 *  timeline. Scoping (dealer/branch) must be applied inside the source
 *  itself, exactly like every other module-owned query in this app. */
export type VehicleEventSource = (serial: string, session: SessionUser) => Promise<VehicleEvent[]>;

export type MaintenanceStatus = 'normal' | 'due_soon' | 'overdue' | 'none';
export type VehicleOperationalStatus = 'normal' | 'open_job';

/** Vehicle 360 header — single source of truth summary for one serial. */
export interface Vehicle360Header {
  serial: string;
  model: string | null;
  engineNumber: string | null;
  retailDate: string | null;
  dealerId: string | null;
  dealerName: string | null;
  branchName: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  currentHourMeter: number | null;
  maintenanceStatus: MaintenanceStatus;
  nextMaintenanceDate: string | null;
  vehicleStatus: VehicleOperationalStatus;
}

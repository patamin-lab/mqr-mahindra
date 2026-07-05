/**
 * Vehicle Summary provider registry.
 *
 * The ONLY file a future module (PDI/NTR/Campaign/Parts Request/...) needs
 * to touch to contribute to Vehicle 360: add its own `VehicleSummaryProvider`
 * implementation here. `vehicle/service.ts`'s aggregation/merge code never
 * changes when a new provider is added.
 */
import { VehicleSummaryProvider } from '../types';
import { MaintenanceSummaryProvider } from '@/features/maintenance/providers/maintenanceSummaryProvider';
import { MqrSummaryProvider } from '@/features/mqr/providers/mqrSummaryProvider';
import { NtrSummaryProvider } from '@/features/ntr/providers/ntrSummaryProvider';

// Order matters: `vehicle/service.ts`'s mergeContribution() lets the first
// provider to set a non-null field win. NTR is the authoritative source of
// "current owner" (the real registered customer), so it runs before
// Maintenance/MQR's own incidental customer-name contributions.
export const VEHICLE_SUMMARY_PROVIDERS: VehicleSummaryProvider[] = [
  new NtrSummaryProvider(),
  new MaintenanceSummaryProvider(),
  new MqrSummaryProvider(),
];

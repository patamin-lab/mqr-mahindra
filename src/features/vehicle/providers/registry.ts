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

export const VEHICLE_SUMMARY_PROVIDERS: VehicleSummaryProvider[] = [
  new MaintenanceSummaryProvider(),
  new MqrSummaryProvider(),
];

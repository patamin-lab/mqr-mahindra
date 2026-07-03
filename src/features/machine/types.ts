/**
 * Machine domain — type aliases (ADR-009).
 *
 * "Machine" is the ubiquitous business term platform-wide; nothing here is
 * a new shape. Every type is a straight re-export of the existing
 * `vehicle`/`vehicle-health`/`maintenance-due` type it aliases - see
 * `docs/engineering/MACHINE_DOMAIN.md` for why no `src/features/vehicle/`
 * internals were renamed (facade layer, not a rewrite).
 */
export type { VehicleSummary as MachineSummary, VehicleEvent as MachineEvent, VehicleEventType as MachineEventType, VehicleSummaryProvider as MachineSummaryProvider, VehicleOperationalStatus as MachineOperationalStatus } from '@/features/vehicle/types';
export type { Vehicle as Machine } from '@/lib/types';
export type { VehicleSearchResult as MachineSearchResult } from '@/lib/db';

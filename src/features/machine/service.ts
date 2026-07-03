/**
 * MachineService — Machine 360 / Machine Timeline facade (ADR-009).
 *
 * A thin wrapper over `features/vehicle/service.ts`'s existing aggregation
 * logic (`getVehicleSummary`/`getVehicleTimeline`) - chosen over renaming
 * `src/features/vehicle/` itself because no `VehicleRepository`/
 * `VehicleService` class existed to rename, and the aggregation logic
 * inside `vehicle/service.ts` (provider merge, Health Score computation)
 * is unchanged business logic, not something this pass touches. New code
 * (and all new UI/docs) should call `MachineService`, not
 * `features/vehicle/service.ts`, directly.
 */
import { SessionUser } from '@/lib/types';
import { getVehicleSummary, getVehicleTimeline } from '@/features/vehicle/service';
import { MachineEvent, MachineSummary } from './types';

export class MachineService {
  async getMachine360(serial: string, session: SessionUser): Promise<MachineSummary | null> {
    return getVehicleSummary(serial, session);
  }

  async getMachineTimeline(serial: string, session: SessionUser): Promise<MachineEvent[]> {
    return getVehicleTimeline(serial, session);
  }
}

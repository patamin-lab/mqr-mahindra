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
import { fetchMqrRecords } from '@/features/vehicle/eventSources/mqrEvents';
import { fetchMaintenanceHistoryForSerial } from '@/features/maintenance/utils/fetchMaintenanceHistory';
import { Attachment, AttachmentService } from '@/shared/attachments';
import { MachineEvent, MachineSummary } from './types';

export class MachineService {
  constructor(private readonly attachmentService: AttachmentService = new AttachmentService()) {}

  async getMachine360(serial: string, session: SessionUser): Promise<MachineSummary | null> {
    return getVehicleSummary(serial, session);
  }

  async getMachineTimeline(serial: string, session: SessionUser): Promise<MachineEvent[]> {
    return getVehicleTimeline(serial, session);
  }

  /** Machine 360's Attachments section - reads only through
   *  `AttachmentService`, never a storage provider or module table
   *  directly (ADR-010). Same dependency direction as the Timeline
   *  (`vehicle/eventSources`) and Summary (`VehicleSummaryProvider`)
   *  aggregations: Machine depends on MQR/Maintenance's own scoped
   *  "records for this serial" utilities, never the reverse, and never a
   *  raw Supabase query of its own. A future module (PDI, NTR, Campaign)
   *  adds its own two-line block here once it adopts the Attachment
   *  Platform - see docs/engineering/ATTACHMENT_FRAMEWORK.md. */
  async getMachineAttachments(serial: string, session: SessionUser): Promise<Attachment[]> {
    const [mqrRecords, pmRecords] = await Promise.all([
      fetchMqrRecords(serial, session),
      fetchMaintenanceHistoryForSerial(serial, session),
    ]);

    const lists = await Promise.all([
      ...mqrRecords.map((r) => this.attachmentService.list('mqr', 'record', r.job_id)),
      ...pmRecords.map((r) => this.attachmentService.list('pm', 'pm_record', r.id)),
    ]);
    return lists.flat();
  }
}

/**
 * Scoped NTR records for one vehicle serial - owned by the NTR module so
 * Machine 360's Attachments aggregation (`MachineService.getMachineAttachments()`)
 * reads through the same place any future NTR-by-serial consumer would,
 * rather than re-implementing the scoping/exact-match logic. Mirrors
 * `features/maintenance/utils/fetchMaintenanceHistory.ts`'s
 * `fetchMaintenanceHistoryForSerial()` exactly.
 */
import { SessionUser } from '@/lib/types';
import { createNtrService } from '../factory';
import { NtrRecord } from '../types';

/** Raw, scoped NTR records for one serial, newest first. In practice a
 *  tractor has at most one Active NTR registration (see `findActiveBySerial()`'s
 *  own doc comment), but this returns the list shape - same contract every
 *  other module's "records for this serial" utility uses.
 *
 *  Dealer/Branch Scope Platform Standard: scope is resolved entirely by
 *  `listHistory(filter, session)` (`applyScope()`/`resolveBranchScope()`
 *  inside the repository) - this used to hand-roll its own dealer/branch
 *  resolution here, and that hand-rolled version had a real bug (it used
 *  the legacy free-text `session.branch` display name as if it were a
 *  `branch_id` filter value, which could never match a real `branches.id`
 *  UUID, so a DealerUser's Machine 360 view silently saw zero NTR
 *  attachments/records for their own vehicles). */
export async function fetchNtrRecordsForSerial(serial: string, session: SessionUser): Promise<NtrRecord[]> {
  const service = createNtrService();

  const result = await service.listHistory(
    {
      serial,
      page: 1,
      pageSize: 200,
    },
    session
  );

  // listHistory's serial filter may be a substring match (same reasoning
  // as Maintenance's fetchMaintenanceHistoryForSerial) - narrow to an
  // exact match so consumers never see another vehicle's records.
  return result.data.filter((r) => r.serial === serial);
}

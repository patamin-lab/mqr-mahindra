/**
 * Scoped NTR records for one vehicle serial - owned by the NTR module so
 * Machine 360's Attachments aggregation (`MachineService.getMachineAttachments()`)
 * reads through the same place any future NTR-by-serial consumer would,
 * rather than re-implementing the scoping/exact-match logic. Mirrors
 * `features/maintenance/utils/fetchMaintenanceHistory.ts`'s
 * `fetchMaintenanceHistoryForSerial()` exactly.
 */
import { seesAllDealers } from '@/lib/scope';
import { SessionUser } from '@/lib/types';
import { createNtrService } from '../factory';
import { NtrRecord } from '../types';

/** Raw, scoped NTR records for one serial, newest first. In practice a
 *  tractor has at most one Active NTR registration (see `findActiveBySerial()`'s
 *  own doc comment), but this returns the list shape - same contract every
 *  other module's "records for this serial" utility uses. */
export async function fetchNtrRecordsForSerial(serial: string, session: SessionUser): Promise<NtrRecord[]> {
  const service = createNtrService();

  const dealerId = seesAllDealers(session.role) ? undefined : session.dealerId ?? undefined;
  const branchId = !seesAllDealers(session.role) && session.branch ? session.branch : undefined;

  const result = await service.listHistory({
    dealerId,
    branchId,
    serial,
    page: 1,
    pageSize: 200,
  });

  // listHistory's serial filter may be a substring match (same reasoning
  // as Maintenance's fetchMaintenanceHistoryForSerial) - narrow to an
  // exact match so consumers never see another vehicle's records.
  return result.data.filter((r) => r.serial === serial);
}

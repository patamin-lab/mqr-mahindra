import { SessionUser } from '@/lib/types';
import { fetchMaintenanceHistoryForSerial } from '@/features/maintenance/utils/fetchMaintenanceHistory';
import MachinePmPanel from '../MachinePmPanel';
import { MachineSummary } from '../../types';

/**
 * Async section wrapper - PM History is its own (potentially large) query,
 * fetched independently of the page's core summary so it can stream in
 * behind a `<Suspense>` boundary rather than blocking the whole page.
 * `summary` is passed down already-resolved (no second summary fetch) since
 * the Upcoming/Overdue/Compliance figures live on it, not on this query.
 */
export default async function MachinePmSection({ serial, session, summary }: { serial: string; session: SessionUser; summary: MachineSummary }) {
  // Production Stability: unlike every other Machine Passport section,
  // this read does not go through `MachineService`'s `safe()` wrapper (it
  // predates it and is shared with other non-Passport callers - see this
  // helper's own doc comment) - a rejection here must not take down the
  // whole page, so it's caught at this call site instead, same fail-open
  // shape `safe()` gives every other section.
  const pmRecords = await fetchMaintenanceHistoryForSerial(serial, session).catch((err) => {
    console.error('Machine Passport: fetchMaintenanceHistoryForSerial failed', err);
    return [];
  });
  return <MachinePmPanel summary={summary} pmRecords={pmRecords} />;
}

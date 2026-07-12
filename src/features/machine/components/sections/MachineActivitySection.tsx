import { SessionUser } from '@/lib/types';
import { MachineService } from '@/features/machine';
import MachineActivityPanel from '../MachineActivityPanel';

const machineService = new MachineService();

/**
 * Async section wrapper - the Activity Timeline is the most expensive
 * fetch on this page (reads across MQR/PM/NTR record IDs, then a bulk
 * `record_audit_log` query per module) - always streamed in behind its own
 * `<Suspense>` boundary, never blocking Identity/Lifecycle/Ownership above it.
 */
export default async function MachineActivitySection({ serial, session }: { serial: string; session: SessionUser }) {
  const events = await machineService.getMachineAuditTimeline(serial, session);
  return <MachineActivityPanel events={events} />;
}

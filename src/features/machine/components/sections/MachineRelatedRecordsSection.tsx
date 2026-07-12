import { SessionUser } from '@/lib/types';
import { MachineService } from '@/features/machine';
import MachineRelatedRecordsPanel from '../MachineRelatedRecordsPanel';

const machineService = new MachineService();

/**
 * Async section wrapper - Related Records re-reads the same three scoped
 * record sets Warranty/PM/Quality/Activity already read independently
 * (an accepted, pre-existing trade-off on this page - each Suspense
 * section fetches on its own, no shared request-level cache exists yet),
 * so it streams in behind its own `<Suspense>` boundary too rather than
 * blocking the core Identity/Lifecycle/Ownership/Health render.
 */
export default async function MachineRelatedRecordsSection({ serial, session }: { serial: string; session: SessionUser }) {
  const records = await machineService.getMachineRelatedRecords(serial, session);
  return <MachineRelatedRecordsPanel records={records} />;
}

import { SessionUser } from '@/lib/types';
import { MachineService } from '@/features/machine';
import MachineNtrPanel from '../MachineNtrPanel';

const machineService = new MachineService();

/**
 * Async section wrapper (Vehicle 360, ADR-030) - fetches NTR history on its
 * own, independent of the page's core fetch, so its own `<Suspense>`
 * boundary can stream it in separately - same shape as
 * `MachineWarrantySection`/`MachineDeliverySection`.
 */
export default async function MachineNtrSection({ serial, session }: { serial: string; session: SessionUser }) {
  const ntrRecords = await machineService.getMachineNtrHistory(serial, session);
  return <MachineNtrPanel ntrRecords={ntrRecords} />;
}

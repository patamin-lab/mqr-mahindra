import { SessionUser } from '@/lib/types';
import { MachineService } from '@/features/machine';
import MachineWarrantyPanel from '../MachineWarrantyPanel';

const machineService = new MachineService();

/**
 * Async section wrapper - fetches Warranty data on its own, independent of
 * the page's core (Identity/Lifecycle/Ownership) fetch, so a `<Suspense>`
 * boundary around this component can stream it in separately (Machine
 * Digital Passport's "load sections independently" requirement).
 */
export default async function MachineWarrantySection({ serial, session }: { serial: string; session: SessionUser }) {
  const warranty = await machineService.getMachineWarrantySummary(serial, session);
  return <MachineWarrantyPanel warranty={warranty} />;
}

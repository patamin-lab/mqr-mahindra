import { MachineService } from '@/features/machine';
import MachineDeliveryPanel from '../MachineDeliveryPanel';

const machineService = new MachineService();

/**
 * Async section wrapper (ADR-017/ADR-027, Machine Delivery Platform) -
 * fetches Delivery data on its own, independent of the page's core fetch,
 * so its own `<Suspense>` boundary can stream it in separately - same
 * shape as `MachineWarrantySection`/`MachineKnowledgeSection`.
 */
export default async function MachineDeliverySection({ serial }: { serial: string }) {
  const delivery = await machineService.getMachineDeliverySummary(serial);
  return <MachineDeliveryPanel delivery={delivery} />;
}

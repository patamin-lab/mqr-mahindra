import { MachineService } from '@/features/machine';
import { canAccessImportInspection } from '@/lib/scope';
import type { SessionUser } from '@/lib/types';
import MachineImportInspectionHistoryPanel from '../MachineImportInspectionHistoryPanel';

const machineService = new MachineService();

/**
 * Async section wrapper (ADR-017, business-domain correction) - fetches
 * Import Inspection history on its own, independent of the page's core
 * fetch, same shape as `MachineDeliverySection`/`MachineWarrantySection`.
 */
export default async function MachineImportInspectionSection({ serial, session }: { serial: string; session: SessionUser }) {
  const inspections = await machineService.getMachineImportInspectionHistory(serial);
  return <MachineImportInspectionHistoryPanel inspections={inspections} canViewFull={canAccessImportInspection(session.role)} />;
}

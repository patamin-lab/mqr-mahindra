import { SessionUser } from '@/lib/types';
import { MachineService } from '@/features/machine';
import { machineAttachmentsToImageItems } from '../../utils/machineImageItems';
import MachineDocumentsPanel from '../MachineDocumentsPanel';

const machineService = new MachineService();

/**
 * Async section wrapper. Attachment identity crosses server/client boundary;
 * shared client resource provider resolves display URLs on demand.
 */
export default async function MachineDocumentsSection({ serial, session }: { serial: string; session: SessionUser }) {
  const attachments = await machineService.getMachineAttachments(serial, session);
  return <MachineDocumentsPanel items={machineAttachmentsToImageItems(attachments)} />;
}

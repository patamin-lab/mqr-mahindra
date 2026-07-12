import { SessionUser } from '@/lib/types';
import { MachineService } from '@/features/machine';
import { AttachmentService } from '@/shared/attachments';
import MachineDocumentsPanel from '../MachineDocumentsPanel';

const machineService = new MachineService();
const attachmentService = new AttachmentService();

/**
 * Async section wrapper - resolves each attachment's signed URL at request
 * time (same as Machine 360's Attachments section, ADR-010: never persist
 * a storage URL) behind its own `<Suspense>` boundary.
 */
export default async function MachineDocumentsSection({ serial, session }: { serial: string; session: SessionUser }) {
  const attachments = await machineService.getMachineAttachments(serial, session);
  const items = await Promise.all(
    attachments.map(async (a) => {
      const resolved = await attachmentService.getUrl(a.id).catch(() => null);
      return { id: a.id, filename: a.filename, mimeType: a.mimeType, url: resolved?.url ?? null };
    })
  );
  return <MachineDocumentsPanel items={items} />;
}

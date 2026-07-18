import { createImageItem, type ImageItem } from '@/components/shared/image/types';
import type { Attachment } from '@/shared/attachments';

/** Machine documents aggregate attachment rows from MQR, PM, and NTR. Keep
 * durable attachment identity separate from optional legacy display URLs. */
export function machineAttachmentToImageItem(attachment: Attachment): ImageItem {
  const legacyUrl = attachment.driveUrl ?? null;

  return createImageItem({
    id: attachment.id,
    attachmentId: attachment.id,
    displayUrl: legacyUrl,
    sourceKind: legacyUrl ? 'cdn' : 'signed',
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    alt: attachment.filename,
    label: attachment.filename,
    category: attachment.attachmentType,
  });
}

export function machineAttachmentsToImageItems(attachments: readonly Attachment[]): ImageItem[] {
  return attachments.map(machineAttachmentToImageItem);
}

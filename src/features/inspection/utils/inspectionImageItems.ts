import { createImageItem, type ImageItem } from '@/components/shared/image/types';
import type { Attachment } from '@/shared/attachments';

/** Attachment rows may carry `url` in legacy callers. Keep that fallback
 * presentation-only; durable identity remains the attachment ID. */
export type InspectionAttachmentRecord = Attachment & { url?: string | null };

export function inspectionAttachmentToImageItem(attachment: InspectionAttachmentRecord): ImageItem {
  const legacyUrl = attachment.url ?? attachment.driveUrl ?? null;

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

export function inspectionAttachmentsToImageItems(attachments: readonly InspectionAttachmentRecord[]): ImageItem[] {
  return attachments.map(inspectionAttachmentToImageItem);
}

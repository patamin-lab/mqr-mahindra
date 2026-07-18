import { createImageItem, type ImageItem } from '@/components/shared/image/types';
import type { Attachment } from '@/shared/attachments';

/** Case-level Knowledge attachments map to durable ImageItem identity. */
export function knowledgeAttachmentToImageItem(attachment: Attachment): ImageItem {
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

export function knowledgeAttachmentsToImageItems(attachments: readonly Attachment[]): ImageItem[] {
  return attachments.map(knowledgeAttachmentToImageItem);
}

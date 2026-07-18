import { fetchJson } from '@/lib/fetchJson';
import { InMemoryAttachmentResourceProvider } from '@/components/shared/image/resourceProvider';
import { createImageItem, type ImageItem } from '@/components/shared/image/types';

interface AttachmentResourceResponse {
  ok: boolean;
  url?: string;
  expiresAt?: string | null;
}

/** MQR presentation adapter. Authorization and signed URL generation remain
 * owned by the existing authorized attachment route. */
export function createMqrAttachmentResourceProvider(initialItems: readonly ImageItem[] = []): InMemoryAttachmentResourceProvider {
  const metadata = new Map(initialItems.filter((item) => item.attachmentId).map((item) => [item.attachmentId as string, item]));

  return new InMemoryAttachmentResourceProvider(async ({ attachmentId, previous }) => {
    const prior = previous ?? metadata.get(attachmentId);
    const response = await fetchJson<AttachmentResourceResponse>(`/api/attachments/${encodeURIComponent(attachmentId)}`);
    if (!response.url) throw new Error('Attachment resource is unavailable');

    return createImageItem({
      id: prior?.id ?? attachmentId,
      attachmentId,
      displayUrl: response.url,
      sourceKind: 'signed',
      filename: prior?.filename,
      mimeType: prior?.mimeType ?? 'image/*',
      alt: prior?.alt ?? 'MQR attachment',
      label: prior?.label,
      category: prior?.category,
      width: prior?.width,
      height: prior?.height,
      expiresAt: response.expiresAt ?? null,
    });
  });
}

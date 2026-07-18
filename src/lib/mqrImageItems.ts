import type { ImageItem } from '@/components/shared/image';
import type { PhotoLink } from './types';

/** MQR-only adapter: durable attachment IDs remain authoritative while the
 * legacy direct URL remains a presentation fallback for pre-platform rows. */
export function mqrPhotoToImageItem(photo: PhotoLink, id: string, alt: string): ImageItem {
  return {
    id,
    attachmentId: photo.attachmentId ?? null,
    displayUrl: photo.url || null,
    sourceKind: photo.attachmentId ? 'signed' : 'cdn',
    filename: photo.label,
    mimeType: 'image/*',
    alt,
    label: photo.label,
    category: photo.category,
    resourceState: photo.url ? 'loaded' : 'idle',
  };
}

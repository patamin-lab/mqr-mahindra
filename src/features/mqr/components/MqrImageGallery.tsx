'use client';

import { useRef, useState } from 'react';
import { fetchJson } from '@/lib/fetchJson';
import {
  ImageThumbnail,
  ImageViewer,
  InMemoryAttachmentResourceProvider,
  createImageItem,
  type ImageItem,
  type ViewerToolbarLabels,
} from '@/components/shared/image';

interface MqrImageGalleryProps {
  items: ImageItem[];
  labels: ViewerToolbarLabels;
  navigationLabels: { previous: string; next: string; close: string };
}

interface AttachmentResourceResponse {
  ok: boolean;
  url?: string;
  expiresAt?: string | null;
}

/** MQR adapter for the shared image platform. It keeps MQR's category/label
 * mapping outside the shared viewer while using the existing authorized
 * attachment GET route for refreshes. */
export default function MqrImageGallery({ items: initialItems, labels, navigationLabels }: MqrImageGalleryProps) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const provider = useRef(
    new InMemoryAttachmentResourceProvider(async ({ attachmentId, previous }) => {
      const response = await fetchJson<AttachmentResourceResponse>(`/api/attachments/${encodeURIComponent(attachmentId)}`);
      if (!response.url) throw new Error('Image resource is unavailable');
      return createImageItem({
        id: previous?.id ?? attachmentId,
        attachmentId,
        displayUrl: response.url,
        sourceKind: 'signed',
        filename: previous?.filename,
        mimeType: previous?.mimeType ?? 'image/*',
        alt: previous?.alt ?? 'MQR image',
        label: previous?.label,
        category: previous?.category,
        width: previous?.width,
        height: previous?.height,
        expiresAt: response.expiresAt ?? null,
      });
    })
  ).current;

  async function resolveForViewer(item: ImageItem, itemIndex: number) {
    setIndex(itemIndex);
    setOpen(true);
    if (!item.attachmentId) return;
    try {
      const resolved = await provider.get(item.attachmentId);
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? resolved : candidate)));
    } catch {
      const snapshot = provider.getSnapshot(item.attachmentId);
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, resourceState: snapshot.state, error: snapshot.error ?? null } : candidate)));
    }
  }

  async function retry(item: ImageItem) {
    if (!item.attachmentId) return;
    try {
      const resolved = await provider.refresh(item.attachmentId);
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? resolved : candidate)));
    } catch {
      const snapshot = provider.getSnapshot(item.attachmentId);
      setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, resourceState: snapshot.state, error: snapshot.error ?? null } : candidate)));
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item, itemIndex) => (
          <ImageThumbnail key={item.id} item={item} onOpen={(selected) => void resolveForViewer(selected, itemIndex)} className="aspect-square w-full rounded border border-gray-200 object-contain" />
        ))}
      </div>
      <ImageViewer
        items={items}
        initialIndex={index}
        open={open}
        labels={labels}
        navigationLabels={navigationLabels}
        onClose={() => setOpen(false)}
        onRetry={(item) => void retry(item)}
      />
    </>
  );
}

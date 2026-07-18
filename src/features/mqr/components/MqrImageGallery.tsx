'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ImageThumbnail,
  ImageViewer,
  type ImageItem,
  type ViewerToolbarLabels,
} from '@/components/shared/image';
import { createMqrAttachmentResourceProvider } from '../utils/mqrAttachmentResourceProvider';

interface MqrImageGalleryProps {
  items: ImageItem[];
  labels: ViewerToolbarLabels;
  navigationLabels: { previous: string; next: string; close: string };
}

/** MQR adapter for the shared image platform. It keeps MQR's category/label
 * mapping outside the shared viewer while using the existing authorized
 * attachment GET route for refreshes. */
export default function MqrImageGallery({ items: initialItems, labels, navigationLabels }: MqrImageGalleryProps) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const provider = useRef(createMqrAttachmentResourceProvider(initialItems)).current;

  useEffect(() => {
    let active = true;
    void Promise.all(
      initialItems.map(async (item) => {
        if (!item.attachmentId) return null;
        try {
          return { id: item.id, item: await provider.get(item.attachmentId) };
        } catch {
          const snapshot = provider.getSnapshot(item.attachmentId);
          return { id: item.id, item: { ...item, resourceState: snapshot.state, error: snapshot.error ?? null } };
        }
      })
    ).then((resolved) => {
      if (!active) return;
      setItems((current) => current.map((item) => resolved.find((entry) => entry?.id === item.id)?.item ?? item));
    });
    return () => {
      active = false;
    };
  }, [initialItems, provider]);

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

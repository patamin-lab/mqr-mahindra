'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ImageThumbnail,
  ImageViewer,
  type ImageItem,
  type ViewerToolbarLabels,
} from '@/components/shared/image';
import { createMaintenanceAttachmentResourceProvider } from '../utils/maintenanceAttachmentResourceProvider';

interface MaintenanceImageGalleryProps {
  items: ImageItem[];
  labels: ViewerToolbarLabels;
  navigationLabels: { previous: string; next: string; close: string };
}

/** PM consumer of the shared thumbnail, viewer, transform, and resource
 * provider contracts. Legacy URLs remain usable while attachment-backed
 * resources are refreshed through the authorized route. */
export default function MaintenanceImageGallery({ items: initialItems, labels, navigationLabels }: MaintenanceImageGalleryProps) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const provider = useRef(createMaintenanceAttachmentResourceProvider(initialItems)).current;

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

  async function openItem(item: ImageItem, itemIndex: number) {
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
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item, itemIndex) => (
          <ImageThumbnail
            key={item.id}
            item={item}
            onOpen={(selected) => void openItem(selected, itemIndex)}
            className="h-32 w-full rounded border bg-gray-100 object-contain"
          />
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

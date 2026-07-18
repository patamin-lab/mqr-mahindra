'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ImageThumbnail,
  ImageViewer,
  type ImageItem,
  type ViewerToolbarLabels,
} from '@/components/shared/image';
import { createKnowledgeAttachmentResourceProvider } from '../utils/knowledgeAttachmentResourceProvider';

interface KnowledgeDocumentsGalleryProps {
  items: ImageItem[];
  emptyMessage: string;
  unavailableMessage: string;
  openLabel: string;
  downloadLabel: string;
  labels: ViewerToolbarLabels;
  navigationLabels: { previous: string; next: string; close: string };
}

function isImage(item: ImageItem): boolean {
  return item.mimeType.startsWith('image/');
}

function attachmentKind(item: ImageItem): string {
  if (item.mimeType === 'application/pdf') return 'PDF';
  if (item.mimeType.startsWith('video/')) return 'Video';
  if (item.mimeType.startsWith('audio/')) return 'Audio';
  return 'Attachment';
}

/** Knowledge adapter. Shared image primitives own image rendering,
 * transforms, resource state, and retry. Non-image records keep open/download
 * compatibility without a second viewer implementation. */
export default function KnowledgeDocumentsGallery({
  items: initialItems,
  emptyMessage,
  unavailableMessage,
  openLabel,
  downloadLabel,
  labels,
  navigationLabels,
}: KnowledgeDocumentsGalleryProps) {
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const provider = useRef(createKnowledgeAttachmentResourceProvider(initialItems)).current;
  const imageItems = items.filter(isImage);
  const otherItems = items.filter((item) => !isImage(item));

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
      {imageItems.length === 0 && otherItems.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <>
          {imageItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {imageItems.map((item, itemIndex) => (
                <ImageThumbnail
                  key={item.id}
                  item={item}
                  onOpen={(selected) => void openItem(selected, itemIndex)}
                  className="aspect-square w-full rounded border border-gray-200 object-contain"
                />
              ))}
            </div>
          )}
          {otherItems.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {otherItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-1 rounded border border-gray-200 p-2">
                  <div className="flex aspect-square items-center justify-center rounded bg-gray-50 text-sm text-gray-500">{attachmentKind(item)}</div>
                  <div className="truncate text-xs text-gray-500" title={item.filename ?? item.alt}>
                    {item.displayUrl ? item.filename ?? item.alt : unavailableMessage}
                  </div>
                  {item.displayUrl && (
                    <div className="flex gap-2 text-xs">
                      <a href={item.displayUrl} target="_blank" rel="noreferrer" className="text-brand-red hover:underline">
                        {openLabel}
                      </a>
                      <a href={item.displayUrl} download={item.filename} className="text-brand-red hover:underline">
                        {downloadLabel}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <ImageViewer
        items={imageItems}
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

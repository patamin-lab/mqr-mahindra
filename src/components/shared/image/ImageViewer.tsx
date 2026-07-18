'use client';

import { useEffect, useState } from 'react';
import ImagePreview from './ImagePreview';
import type { ViewerToolbarLabels } from './ViewerToolbar';
import type { ImageItem } from './types';

export interface ImageViewerProps {
  items: ImageItem[];
  initialIndex?: number;
  open: boolean;
  labels: ViewerToolbarLabels;
  onClose: () => void;
  onRetry?: (item: ImageItem) => void;
  navigationLabels?: { previous: string; next: string; close: string };
}

export default function ImageViewer({ items, initialIndex = 0, open, labels, onClose, onRetry, navigationLabels }: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const item = items[index];

  useEffect(() => {
    if (open) setIndex(Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)));
  }, [initialIndex, items.length, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1));
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(items.length - 1, current + 1));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [items.length, onClose, open]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={item.alt} onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
        <ImagePreview item={item} labels={labels} onRetry={onRetry ? () => onRetry(item) : undefined} />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0} className="rounded bg-white/10 px-3 py-2 text-white disabled:opacity-40">{navigationLabels?.previous ?? 'Previous'}</button>
          <button type="button" onClick={onClose} className="rounded bg-white/10 px-3 py-2 text-white">{navigationLabels?.close ?? 'Close'}</button>
          <button type="button" onClick={() => setIndex((current) => Math.min(items.length - 1, current + 1))} disabled={index === items.length - 1} className="rounded bg-white/10 px-3 py-2 text-white disabled:opacity-40">{navigationLabels?.next ?? 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

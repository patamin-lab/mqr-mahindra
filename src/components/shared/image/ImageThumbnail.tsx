'use client';

import type { ImageItem } from './types';

export interface ImageThumbnailProps {
  item: ImageItem;
  onOpen?: (item: ImageItem) => void;
  className?: string;
}

export default function ImageThumbnail({ item, onOpen, className }: ImageThumbnailProps) {
  const content = item.displayUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.displayUrl} alt={item.alt} loading="lazy" decoding="async" className={className ?? 'aspect-square w-full rounded object-contain'} />
  ) : (
    <span className="flex aspect-square w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
      {item.resourceState === 'failed' ? 'Image unavailable' : 'Loading image'}
    </span>
  );

  return onOpen ? (
    <button type="button" onClick={() => onOpen(item)} className="block w-full text-left" disabled={!item.displayUrl}>
      {content}
    </button>
  ) : (
    content
  );
}

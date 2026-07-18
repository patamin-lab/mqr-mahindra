'use client';

import { useReducer, useRef, useState } from 'react';
import ViewerToolbar, { type ViewerToolbarLabels } from './ViewerToolbar';
import { DEFAULT_IMAGE_TRANSFORM, imageTransformReducer } from './transformState';
import type { ImageItem } from './types';

export interface ImagePreviewProps {
  item: ImageItem;
  labels: ViewerToolbarLabels;
  onRetry?: () => void;
}

export default function ImagePreview({ item, labels, onRetry }: ImagePreviewProps) {
  const [state, dispatch] = useReducer(imageTransformReducer, DEFAULT_IMAGE_TRANSFORM);
  const [dragging, setDragging] = useState(false);
  const previousPoint = useRef<{ x: number; y: number } | null>(null);

  if (item.resourceState === 'failed') {
    return (
      <div className="rounded bg-white p-6 text-center text-sm text-gray-700" role="alert">
        <p>{item.error?.message ?? 'Image unavailable'}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-3 rounded bg-brand-red px-3 py-2 text-white">Retry</button>}
      </div>
    );
  }

  if (!item.displayUrl || item.resourceState === 'loading' || item.resourceState === 'retrying' || item.resourceState === 'expired') {
    return <div className="flex min-h-48 items-center justify-center rounded bg-black/10 text-sm text-gray-600">Loading image</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <ViewerToolbar state={state} dispatch={dispatch} labels={labels} />
      <div
        className={`flex max-h-[80vh] min-h-48 items-center justify-center overflow-hidden bg-black/10 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={(event) => {
          if (state.zoom <= 1) return;
          setDragging(true);
          previousPoint.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragging || !previousPoint.current) return;
          dispatch({ type: 'pan', x: event.clientX - previousPoint.current.x, y: event.clientY - previousPoint.current.y });
          previousPoint.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={() => {
          setDragging(false);
          previousPoint.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.displayUrl}
          alt={item.alt}
          draggable={false}
          className="max-h-[80vh] max-w-full select-none object-contain"
          style={{ transform: `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom}) rotate(${state.rotation}deg)` }}
        />
      </div>
    </div>
  );
}

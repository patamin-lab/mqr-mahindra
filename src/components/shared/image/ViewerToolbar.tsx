'use client';

import type { Dispatch } from 'react';
import type { ImageTransformAction, ImageTransformState } from './transformState';

export interface ViewerToolbarLabels {
  zoomOut: string;
  zoomIn: string;
  rotate: string;
  reset: string;
}

export interface ViewerToolbarProps {
  state: ImageTransformState;
  dispatch: Dispatch<ImageTransformAction>;
  labels: ViewerToolbarLabels;
}

export default function ViewerToolbar({ state, dispatch, labels }: ViewerToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1 rounded bg-black/60 p-1" role="toolbar" aria-label="Image controls">
      <button type="button" title={labels.zoomOut} aria-label={labels.zoomOut} onClick={() => dispatch({ type: 'zoomOut' })} className="rounded px-2 py-1 text-sm text-white hover:bg-white/20">
        −
      </button>
      <span className="min-w-12 text-center text-xs text-white" aria-live="polite">{Math.round(state.zoom * 100)}%</span>
      <button type="button" title={labels.zoomIn} aria-label={labels.zoomIn} onClick={() => dispatch({ type: 'zoomIn' })} className="rounded px-2 py-1 text-sm text-white hover:bg-white/20">
        +
      </button>
      <button type="button" title={labels.rotate} aria-label={labels.rotate} onClick={() => dispatch({ type: 'rotate' })} className="rounded px-2 py-1 text-sm text-white hover:bg-white/20">
        ↻
      </button>
      <button type="button" title={labels.reset} aria-label={labels.reset} onClick={() => dispatch({ type: 'reset' })} className="rounded px-2 py-1 text-sm text-white hover:bg-white/20">
        1:1
      </button>
    </div>
  );
}

export interface ImageTransformState {
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
}

export type ImageTransformAction =
  | { type: 'zoomIn'; step?: number; max?: number }
  | { type: 'zoomOut'; step?: number; min?: number }
  | { type: 'pan'; x: number; y: number }
  | { type: 'rotate'; degrees?: number }
  | { type: 'reset' };

export const DEFAULT_IMAGE_TRANSFORM: ImageTransformState = { zoom: 1, panX: 0, panY: 0, rotation: 0 };

export function imageTransformReducer(state: ImageTransformState, action: ImageTransformAction): ImageTransformState {
  switch (action.type) {
    case 'zoomIn':
      return { ...state, zoom: Math.min(action.max ?? 4, +(state.zoom + (action.step ?? 0.25)).toFixed(2)) };
    case 'zoomOut':
      return { ...state, zoom: Math.max(action.min ?? 0.5, +(state.zoom - (action.step ?? 0.25)).toFixed(2)) };
    case 'pan':
      return { ...state, panX: state.panX + action.x, panY: state.panY + action.y };
    case 'rotate':
      return { ...state, rotation: (state.rotation + (action.degrees ?? 90) + 360) % 360 };
    case 'reset':
      return DEFAULT_IMAGE_TRANSFORM;
  }
}

import { describe, expect, it } from 'vitest';
import { DEFAULT_IMAGE_TRANSFORM, imageTransformReducer } from '../transformState';

describe('imageTransformReducer', () => {
  it('supports bounded zoom, pan, and rotation', () => {
    let state = imageTransformReducer(DEFAULT_IMAGE_TRANSFORM, { type: 'zoomIn' });
    state = imageTransformReducer(state, { type: 'pan', x: 12, y: -4 });
    state = imageTransformReducer(state, { type: 'rotate' });

    expect(state).toEqual({ zoom: 1.25, panX: 12, panY: -4, rotation: 90 });
    expect(imageTransformReducer(state, { type: 'zoomOut', step: 10, min: 0.5 }).zoom).toBe(0.5);
  });

  it('resets every transform value', () => {
    const changed = { zoom: 2, panX: 20, panY: 10, rotation: 270 };
    expect(imageTransformReducer(changed, { type: 'reset' })).toEqual(DEFAULT_IMAGE_TRANSFORM);
  });
});

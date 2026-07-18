import { describe, expect, it } from 'vitest';
import { mqrPhotoToImageItem } from './mqrImageItems';

describe('mqrPhotoToImageItem', () => {
  it('maps Attachment Platform photos to presentation resources', () => {
    const item = mqrPhotoToImageItem(
      { category: 'after_repair', label: 'After repair', url: 'https://signed/photo', attachmentId: 'att-1' },
      'photo-1',
      'After repair'
    );

    expect(item).toMatchObject({ id: 'photo-1', attachmentId: 'att-1', displayUrl: 'https://signed/photo', sourceKind: 'signed', resourceState: 'loaded' });
  });

  it('preserves legacy URL-only records as presentation fallbacks', () => {
    const item = mqrPhotoToImageItem(
      { category: 'odometer', label: 'Odometer', url: 'https://drive/photo' },
      'photo-legacy',
      'Odometer'
    );

    expect(item).toMatchObject({ id: 'photo-legacy', attachmentId: null, displayUrl: 'https://drive/photo', sourceKind: 'cdn', resourceState: 'loaded' });
  });
});

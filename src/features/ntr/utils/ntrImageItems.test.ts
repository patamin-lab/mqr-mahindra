import { describe, expect, it } from 'vitest';
import type { NtrRecord } from '../types';
import { ntrImageReferenceToImageItem, ntrRecordToImageItems } from './ntrImageItems';

describe('NTR image platform mapping', () => {
  it('preserves attachment identity and uses signed resources', () => {
    const item = ntrImageReferenceToImageItem({
      id: 'ntr-photo-1',
      url: 'https://signed.example/photo',
      attachmentId: 'att-1',
      label: 'Customer ID',
      category: 'CUSTOMER_ID',
    });

    expect(item).toMatchObject({
      id: 'ntr-photo-1',
      attachmentId: 'att-1',
      displayUrl: 'https://signed.example/photo',
      sourceKind: 'signed',
      resourceState: 'loaded',
    });
  });

  it('keeps legacy URL-only records and partial attachment records visible', () => {
    const record = {
      id: 'ntr-1',
      photo_customer_id_url: 'https://legacy.example/customer-id',
      photo_customer_id_attachment_id: null,
      photo_customer_tractor_url: null,
      photo_customer_tractor_attachment_id: 'att-partial',
      photo_serial_plate_url: 'https://signed.example/serial',
      photo_serial_plate_attachment_id: 'att-serial',
      photo_hour_meter_url: null,
      photo_hour_meter_attachment_id: null,
      photo_signed_document_url: null,
      photo_signed_document_attachment_id: null,
      additional_photos: [{ url: 'https://legacy.example/additional', label: 'Booking', type: 'BOOKING_DOCUMENT' as const }],
    } as NtrRecord;

    const items = ntrRecordToImageItems(record, {
      customerId: 'Customer ID',
      customerTractor: 'Customer tractor',
      serialPlate: 'Serial plate',
      hourMeter: 'Hour meter',
      deliverySheet: 'Delivery sheet',
    });

    expect(items.map((item) => item.id)).toEqual(['ntr-1-customer-id', 'ntr-1-customer-tractor', 'ntr-1-serial-plate', 'ntr-1-additional-0']);
    expect(items[0]).toMatchObject({ attachmentId: null, sourceKind: 'cdn', displayUrl: 'https://legacy.example/customer-id' });
    expect(items[1]).toMatchObject({ attachmentId: 'att-partial', sourceKind: 'signed', displayUrl: null, resourceState: 'idle' });
    expect(items[3]).toMatchObject({ category: 'BOOKING_DOCUMENT', label: 'Booking' });
  });
});

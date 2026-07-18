import { describe, expect, it } from 'vitest';
import { maintenancePhotoSlotToImageItem, maintenanceRecordToImageItems } from './maintenanceImageItems';
import type { MaintenanceRecord } from '../types';

const record = {
  id: 'pm-1',
  meter_photo_url: 'https://legacy.example/meter.jpg',
  meter_photo_attachment_id: null,
  nameplate_photo_url: null,
  nameplate_photo_attachment_id: 'att-nameplate',
  report_photo_url: 'https://legacy.example/report.jpg',
  report_photo_attachment_id: 'att-report',
} as MaintenanceRecord;

describe('maintenance image mapping', () => {
  it('preserves PM slot order, attachment identity, and legacy URLs', () => {
    const items = maintenanceRecordToImageItems(record, { meter: 'Meter', nameplate: 'Nameplate', report: 'Report' });

    expect(items.map((item) => item.category)).toEqual(['meter', 'nameplate', 'report']);
    expect(items[0]).toMatchObject({ id: 'pm-1-meter', attachmentId: null, displayUrl: 'https://legacy.example/meter.jpg', sourceKind: 'cdn' });
    expect(items[1]).toMatchObject({ id: 'pm-1-nameplate', attachmentId: 'att-nameplate', displayUrl: null, sourceKind: 'signed' });
    expect(items[2]).toMatchObject({ id: 'pm-1-report', attachmentId: 'att-report', displayUrl: 'https://legacy.example/report.jpg', sourceKind: 'signed' });
  });

  it('maps upload state to the shared thumbnail contract', () => {
    expect(maintenancePhotoSlotToImageItem('report', { url: 'blob:test', attachmentId: 'att-1' }, 'Report')).toMatchObject({
      id: 'pm-slot-report',
      attachmentId: 'att-1',
      displayUrl: 'blob:test',
      category: 'report',
      alt: 'Report',
    });
  });
});

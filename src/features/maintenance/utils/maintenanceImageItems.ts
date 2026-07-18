import { createImageItem, type ImageItem } from '@/components/shared/image/types';
import type { MaintenanceRecord, MaintenanceAttachmentKind } from '../types';

export interface MaintenanceImageReference {
  id: string;
  url: string | null;
  attachmentId?: string | null;
  label: string;
  category: MaintenanceAttachmentKind;
}

export interface MaintenanceImageLabels {
  meter: string;
  nameplate: string;
  report: string;
}

export function maintenanceImageReferenceToImageItem(reference: MaintenanceImageReference): ImageItem {
  return createImageItem({
    id: reference.id,
    attachmentId: reference.attachmentId ?? null,
    displayUrl: reference.url,
    sourceKind: reference.attachmentId ? 'signed' : 'cdn',
    filename: reference.label,
    mimeType: 'image/*',
    alt: reference.label,
    label: reference.label,
    category: reference.category,
  });
}

export function maintenancePhotoSlotToImageItem(
  slot: MaintenanceAttachmentKind,
  photo: { url: string | null; attachmentId: string | null },
  label: string
): ImageItem {
  return maintenanceImageReferenceToImageItem({
    id: `pm-slot-${slot}`,
    url: photo.url,
    attachmentId: photo.attachmentId,
    label,
    category: slot,
  });
}

export function maintenanceRecordToImageItems(record: MaintenanceRecord, labels: MaintenanceImageLabels): ImageItem[] {
  return (
    [
      {
        id: `${record.id}-meter`,
        url: record.meter_photo_url,
        attachmentId: record.meter_photo_attachment_id,
        label: labels.meter,
        category: 'meter' as const,
      },
      {
        id: `${record.id}-nameplate`,
        url: record.nameplate_photo_url,
        attachmentId: record.nameplate_photo_attachment_id,
        label: labels.nameplate,
        category: 'nameplate' as const,
      },
      {
        id: `${record.id}-report`,
        url: record.report_photo_url,
        attachmentId: record.report_photo_attachment_id,
        label: labels.report,
        category: 'report' as const,
      },
    ] satisfies MaintenanceImageReference[]
  )
    .filter((reference) => Boolean(reference.url || reference.attachmentId))
    .map(maintenanceImageReferenceToImageItem);
}

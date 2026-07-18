import { createImageItem, type ImageItem } from '@/components/shared/image/types';
import type { NtrAdditionalPhoto, NtrRecord } from '../types';

export interface NtrImageReference {
  id: string;
  url: string | null;
  attachmentId?: string | null;
  label: string;
  category: string;
}

export interface NtrImageLabels {
  customerId: string;
  customerTractor: string;
  serialPlate: string;
  hourMeter: string;
  deliverySheet: string;
}

/** Maps NTR's fixed-slot and additional-photo records to the shared
 * presentation contract without changing NTR categories or ordering. */
export function ntrImageReferenceToImageItem(reference: NtrImageReference): ImageItem {
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

export function ntrPhotoSlotToImageItem(slot: string, photo: { url: string | null; attachmentId: string | null }, label: string): ImageItem {
  return ntrImageReferenceToImageItem({
    id: `ntr-slot-${slot}`,
    url: photo.url,
    attachmentId: photo.attachmentId,
    label,
    category: slot,
  });
}

function additionalPhotoReference(recordId: string, photo: NtrAdditionalPhoto, index: number): NtrImageReference {
  return {
    id: `${recordId}-additional-${index}`,
    url: photo.url || null,
    attachmentId: photo.attachmentId,
    label: photo.label,
    category: photo.type ?? 'OTHER',
  };
}

/** Fixed NTR slots remain first; additional photo array order is preserved. */
export function ntrRecordToImageItems(record: NtrRecord, labels: NtrImageLabels): ImageItem[] {
  const fixed: NtrImageReference[] = [
    { id: `${record.id}-customer-id`, url: record.photo_customer_id_url, attachmentId: record.photo_customer_id_attachment_id, label: labels.customerId, category: 'CUSTOMER_ID' },
    { id: `${record.id}-customer-tractor`, url: record.photo_customer_tractor_url, attachmentId: record.photo_customer_tractor_attachment_id, label: labels.customerTractor, category: 'CUSTOMER_TRACTOR' },
    { id: `${record.id}-serial-plate`, url: record.photo_serial_plate_url, attachmentId: record.photo_serial_plate_attachment_id, label: labels.serialPlate, category: 'SERIAL_PLATE' },
    { id: `${record.id}-hour-meter`, url: record.photo_hour_meter_url, attachmentId: record.photo_hour_meter_attachment_id, label: labels.hourMeter, category: 'HOUR_METER' },
    { id: `${record.id}-delivery-sheet`, url: record.photo_signed_document_url, attachmentId: record.photo_signed_document_attachment_id, label: labels.deliverySheet, category: 'DELIVERY_SHEET' },
  ];

  return [...fixed, ...record.additional_photos.map((photo, index) => additionalPhotoReference(record.id, photo, index))]
    .filter((reference) => Boolean(reference.url || reference.attachmentId))
    .map(ntrImageReferenceToImageItem);
}

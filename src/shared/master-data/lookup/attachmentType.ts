/**
 * MASP Platform — Lookup Platform: Attachment Type.
 *
 * The canonical attachment-type vocabulary already lives in the
 * Attachment Platform (`shared/attachments/types.ts`, a sibling platform
 * service) - this module never redeclares it, only re-exports it under
 * the Lookup Platform's facade so a business module can reach every
 * controlled vocabulary through one `MasterDataService` surface instead
 * of importing `shared/attachments` for this one concern and
 * `shared/master-data` for every other lookup.
 */
import type { AttachmentType } from '@/shared/attachments';

export const ATTACHMENT_TYPE_VALUES: AttachmentType[] = [
  'MasterData',
  'MeterPhoto',
  'NameplatePhoto',
  'ReportPhoto',
  'DefectPhoto',
  'RepairPhoto',
  'CustomerSignature',
  'Invoice',
  'Warranty',
  'Video',
  'Audio',
  'Pdf',
  'Excel',
  'Other',
  'CustomerTractorPhoto',
  'SerialPlatePhoto',
  'HourMeterPhoto',
  'DeliverySheetPhoto',
  'CustomerIdCardPhoto',
  'BookingDocumentPhoto',
  'TaxInvoicePhoto',
  'CrmLeadScreenshotPhoto',
];

export type { AttachmentType };

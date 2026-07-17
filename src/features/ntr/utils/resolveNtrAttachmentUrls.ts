import { AttachmentService } from '@/shared/attachments';
import type { NtrRecord } from '../types';

const attachmentService = new AttachmentService();

/**
 * A photo/video uploaded via the Attachment Platform stores its display
 * URL as a signed URL that expires (~1h,
 * `SupabaseStorageProvider`/`CloudflareR2Provider`'s
 * `DEFAULT_SIGNED_URL_TTL_SECONDS`) - resolve a fresh one here, server-side,
 * before rendering, same as every other module
 * (`pm-records/[id]/page.tsx`'s equivalent block). This was NTR's actual
 * root cause for "previously uploaded images no longer display" - the sole
 * module skipping this resolve step and rendering the stale persisted
 * `_url` directly. Mutates `record` in place and fails open (leaves the
 * stale `_url`) rather than blanking the image if resolution errors.
 * Shared by the NTR detail and edit pages so the resolve loop isn't
 * duplicated.
 */
export async function resolveNtrAttachmentUrls(record: NtrRecord): Promise<void> {
  const resolves: Promise<void>[] = [];
  const resolveInto = (attachmentId: string | null | undefined, apply: (url: string) => void) => {
    if (!attachmentId) return;
    resolves.push(
      attachmentService
        .getUrl(attachmentId)
        .then((resolved) => {
          if (resolved) apply(resolved.url);
        })
        .catch(() => undefined)
    );
  };

  resolveInto(record.photo_customer_id_attachment_id, (url) => { record.photo_customer_id_url = url; });
  resolveInto(record.photo_customer_tractor_attachment_id, (url) => { record.photo_customer_tractor_url = url; });
  resolveInto(record.photo_serial_plate_attachment_id, (url) => { record.photo_serial_plate_url = url; });
  resolveInto(record.photo_hour_meter_attachment_id, (url) => { record.photo_hour_meter_url = url; });
  resolveInto(record.photo_signed_document_attachment_id, (url) => { record.photo_signed_document_url = url; });
  resolveInto(record.video_attachment_id, (url) => { record.video_url = url; });
  record.additional_photos.forEach((photo) => resolveInto(photo.attachmentId, (url) => { photo.url = url; }));

  await Promise.all(resolves);
}

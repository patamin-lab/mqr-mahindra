import { AttachmentService } from '@/shared/attachments';

/**
 * Corporate PDF Standardization - Defect 1 root cause fix.
 *
 * Every PDF export route (NTR/PM/MQR) was passing its record straight from
 * `getById()`/`getRecordByJobId()` into its renderer, which then read the
 * record's own persisted `*_url` columns directly. Those columns hold a
 * Supabase/Cloudflare signed URL with a finite TTL (`DEFAULT_SIGNED_URL_
 * TTL_SECONDS`, 1 hour) - the exact same staleness bug the app's own
 * detail pages already had to work around (`AttachmentService.getUrl()`
 * before render), but the export routes never got that fix. A photo
 * uploaded more than an hour before someone clicks "Export PDF" - the
 * overwhelmingly common case for a report reviewed after the fact -
 * fetches a 403/expired-signature response and silently disappears from
 * the PDF with no indication why.
 *
 * Resolves one attachment to a fresh URL, failing open to the record's
 * already-persisted URL (for a pre-Attachment-Platform legacy record with
 * no `attachmentId` at all, or if resolution itself fails) rather than
 * blanking the photo outright - same fail-open discipline every other
 * URL-refresh call site in this app already uses.
 */
export async function resolvePdfAttachmentUrl(
  attachmentService: AttachmentService,
  attachmentId: string | null | undefined,
  fallbackUrl: string | null
): Promise<string | null> {
  if (!attachmentId) return fallbackUrl;
  const resolved = await attachmentService.getUrl(attachmentId).catch((err) => {
    console.error(`PDF export: attachment URL resolution failed for ${attachmentId}`, err);
    return null;
  });
  return resolved?.url ?? fallbackUrl;
}

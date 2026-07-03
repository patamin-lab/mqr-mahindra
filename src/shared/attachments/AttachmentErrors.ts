/**
 * Business-friendly error surface for the Attachment Platform's API
 * boundary. Never leaks a raw Supabase/Google Drive/OAuth/bucket/SDK
 * message to a caller - every API route that touches `AttachmentService`
 * catches its own errors and translates them through here, logging the
 * real error server-side (`console.error`) for diagnosis.
 */
export type AttachmentErrorContext = 'upload' | 'delete' | 'access' | 'archive' | 'restore';

const MESSAGES: Record<AttachmentErrorContext, string> = {
  upload: 'Upload failed.',
  delete: 'Could not delete this attachment.',
  access: 'Attachment is temporarily unavailable.',
  archive: 'Archive is currently unavailable.',
  restore: 'Could not restore this attachment.',
};

export function toUserFacingAttachmentError(err: unknown, context: AttachmentErrorContext): string {
  console.error(`[attachments:${context}]`, err);
  return MESSAGES[context];
}

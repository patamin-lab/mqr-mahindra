import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { Attachment, AttachmentType } from '@/shared/attachments';

// Same reasoning as uploadFileSmart.ts's PROXY_SAFE_BYTES - Vercel caps a
// serverless function's request body at 4.5MB regardless of which storage
// backend the route then forwards to, so a file above this size still
// needs to bypass our own API route for the actual bytes.
const PROXY_SAFE_BYTES = 4 * 1024 * 1024;

export interface UploadAttachmentParams {
  module: string;
  entityType: string;
  entityId: string;
  attachmentType: AttachmentType;
  /** Used only in the thrown error message on failure - never sent to the
   *  server or stored anywhere. */
  label: string;
}

export interface UploadAttachmentResult {
  attachmentId: string;
  url: string | null;
  filename: string;
  mimeType: string;
}

/**
 * The one client-side entry point every module's form uses to attach a
 * file - the Attachment Platform's replacement for `uploadFileSmart.ts`.
 * A module never talks to `/api/upload*`, Google Drive, or Supabase
 * Storage directly; it only ever calls this, which talks to
 * `/api/attachments*` (backed by `AttachmentService`). Small files go
 * through a single-shot POST; large files (mirroring the old Drive
 * resumable path) get a Supabase signed upload URL and PUT straight to
 * storage, bypassing our own function's body-size cap.
 */
export async function uploadAttachment(file: File, params: UploadAttachmentParams, onProgress?: (pct: number) => void): Promise<UploadAttachmentResult> {
  try {
    if (file.size > PROXY_SAFE_BYTES) {
      const init = await fetchJson<{ attachmentId: string; uploadUrl: string }>('/api/attachments/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: params.module,
          entityType: params.entityType,
          entityId: params.entityId,
          attachmentType: params.attachmentType,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
        }),
      });

      const putRes = await fetch(init.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ (${putRes.status})`);
      onProgress?.(100);

      const final = await fetchJson<{ attachment: Attachment; url: string | null }>('/api/attachments/upload/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachmentId: init.attachmentId }),
      });
      return { attachmentId: final.attachment.id, url: final.url, filename: final.attachment.filename, mimeType: final.attachment.mimeType };
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('module', params.module);
    fd.append('entityType', params.entityType);
    fd.append('entityId', params.entityId);
    fd.append('attachmentType', params.attachmentType);
    const json = await fetchJson<{ attachment: Attachment; url: string | null }>('/api/attachments', { method: 'POST', body: fd });
    onProgress?.(100);
    return { attachmentId: json.attachment.id, url: json.url, filename: json.attachment.filename, mimeType: json.attachment.mimeType };
  } catch (err) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') throw err;
    throw new Error(`อัปโหลด${params.label}ไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}`);
  }
}

/** After a new record is saved and its real ID is known, re-tags every
 *  attachment uploaded against the temporary entity ID used while the
 *  form was still open - the client-side call to `/api/attachments/reassign`
 *  (see that route, and `AttachmentService.reassignEntity()`). */
export async function reassignAttachments(attachmentIds: string[], entityId: string): Promise<void> {
  if (attachmentIds.length === 0) return;
  await fetchJson('/api/attachments/reassign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: attachmentIds, entityId }),
  });
}

/** A client-generated, temporary entity ID to upload attachments against
 *  before a new record has a real ID yet - reassigned via
 *  `reassignAttachments()` once the record is saved. */
export function newPendingEntityId(): string {
  return `pending-${crypto.randomUUID()}`;
}

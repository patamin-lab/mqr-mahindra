import { createHash } from 'crypto';
import { getSupabase, STORAGE_BUCKET } from '@/lib/supabase';
import { StorageProvider, StoredObject } from './StorageProvider';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Primary storage backend (see ADR-010) - `mqr-files` is the existing
 *  Supabase Storage bucket, previously dead code (`STORAGE_BUCKET` was
 *  declared in `lib/supabase.ts` but never referenced) after the app moved
 *  to Google Drive; the Attachment Platform is the first real consumer. */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'SUPABASE' as const;

  async upload(params: { path: string; buffer: Buffer; mimeType: string }): Promise<StoredObject> {
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(params.path, params.buffer, {
      contentType: params.mimeType,
      upsert: false,
    });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    return { locator: params.path, checksum: sha256Hex(params.buffer), sizeBytes: params.buffer.byteLength, url: null };
  }

  async delete(locator: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([locator]);
    if (error) throw new Error(`Supabase Storage delete failed: ${error.message}`);
  }

  async download(locator: string): Promise<Buffer> {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(locator);
    if (error || !data) throw new Error(`Supabase Storage download failed: ${error?.message ?? 'no data'}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async exists(locator: string): Promise<boolean> {
    const supabase = getSupabase();
    const dir = locator.split('/').slice(0, -1).join('/');
    const name = locator.split('/').pop() ?? locator;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(dir, { search: name });
    if (error) throw new Error(`Supabase Storage exists check failed: ${error.message}`);
    return !!data && data.some((f) => f.name === name);
  }

  async getSignedUrl(locator: string, _mimeType: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<{ url: string; expiresAt: string | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(locator, expiresInSeconds);
    if (error || !data) throw new Error(`Supabase Storage signed URL failed: ${error?.message ?? 'no data'}`);
    return { url: data.signedUrl, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
  }

  async list(prefix: string): Promise<string[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(prefix);
    if (error) throw new Error(`Supabase Storage list failed: ${error.message}`);
    return (data ?? []).map((f) => (prefix ? `${prefix}/${f.name}` : f.name));
  }

  /** Supabase-specific: a signed *upload* URL the browser can PUT bytes to
   *  directly, never through our own Next.js API route. This is the
   *  Supabase-Storage equivalent of what `googleDrive.ts`'s
   *  `initResumableUpload()` did for Google Drive - the mechanism large
   *  files (e.g. MQR's video attachment) need to get past Vercel's 4.5MB
   *  request-body cap, since a single-shot multipart POST through our own
   *  route is capped there regardless of which storage backend receives
   *  it afterward. Not part of the generic `StorageProvider` interface -
   *  `GoogleDriveStorageProvider` never needs this (it already has its own,
   *  separate resumable-upload flow used only for archive uploads, which
   *  are always server-to-server and never this large in one browser PUT). */
  async createSignedUploadUrl(path: string): Promise<{ signedUrl: string; token: string }> {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(`Supabase Storage signed upload URL failed: ${error?.message ?? 'no data'}`);
    return { signedUrl: data.signedUrl, token: data.token };
  }

  /** Confirms a direct-PUT upload landed and reports its real size -
   *  called once the browser reports the PUT succeeded, before the
   *  attachment row is trusted as complete. */
  async statObject(path: string): Promise<{ sizeBytes: number } | null> {
    const supabase = getSupabase();
    const dir = path.split('/').slice(0, -1).join('/');
    const name = path.split('/').pop() ?? path;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(dir, { search: name });
    if (error || !data || data.length === 0) return null;
    const size = (data[0].metadata as { size?: number } | undefined)?.size;
    return { sizeBytes: typeof size === 'number' ? size : 0 };
  }
}

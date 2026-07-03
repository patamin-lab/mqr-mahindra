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

  async getUrl(locator: string, _mimeType: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<{ url: string; expiresAt: string | null }> {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(locator, expiresInSeconds);
    if (error || !data) throw new Error(`Supabase Storage signed URL failed: ${error?.message ?? 'no data'}`);
    return { url: data.signedUrl, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
  }
}

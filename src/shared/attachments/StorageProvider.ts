import { StorageProviderName } from './types';

export interface StoredObject {
  /** Provider-specific locator - a Supabase Storage object path, or a
   *  Google Drive file ID. Opaque to every caller except the provider that
   *  produced it. */
  locator: string;
  checksum: string;
  sizeBytes: number;
  /** Set only when the provider can hand back a directly-renderable URL at
   *  upload time (Google Drive's share link). Supabase's URL is resolved
   *  later, on demand, via `getUrl()` (a signed URL, time-limited). */
  url: string | null;
}

/**
 * One storage backend's implementation of the primitive operations
 * `AttachmentService` composes. No module may call a provider directly -
 * see `docs/engineering/ATTACHMENT_FRAMEWORK.md` §"Provider Independence".
 */
export interface StorageProvider {
  readonly name: StorageProviderName;
  upload(params: { path: string; buffer: Buffer; mimeType: string }): Promise<StoredObject>;
  delete(locator: string): Promise<void>;
  download(locator: string): Promise<Buffer>;
  getUrl(locator: string, mimeType: string, expiresInSeconds?: number): Promise<{ url: string; expiresAt: string | null }>;
}

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
  download(locator: string): Promise<Buffer>;
  delete(locator: string): Promise<void>;
  exists(locator: string): Promise<boolean>;
  getSignedUrl(locator: string, mimeType: string, expiresInSeconds?: number): Promise<{ url: string; expiresAt: string | null }>;
  /** Locators of every object under `prefix` (a path prefix for
   *  path-addressed providers like Supabase/R2; a folder name for
   *  Drive's archive folder). */
  list(prefix: string): Promise<string[]>;
  /** Optional - only `SupabaseStorageProvider` implements this today (see
   *  its own doc comment for why this isn't a Drive concept too). */
  createSignedUploadUrl?(path: string): Promise<{ signedUrl: string; token: string }>;
  statObject?(path: string): Promise<{ sizeBytes: number } | null>;
}

import { createHash } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presignS3Url } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { getR2Config, r2Endpoint, R2Config } from './r2Config';
import { StorageProvider, StoredObject } from './StorageProvider';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  // The AWS SDK v3 Node runtime returns a Node `Readable` for `Body`
  // (the browser/edge runtime would return a web `ReadableStream`
  // instead - not used here, since every caller of this provider runs
  // server-side under Node, same as `SupabaseStorageProvider`/`googleDrive.ts`).
  const stream = body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Cloudflare R2, addressed via its S3-compatible API (`@aws-sdk/client-s3`
 * - Cloudflare's own recommended integration path; R2 has no first-party
 * SDK of its own). Built as a standalone, fully-tested `StorageProvider`
 * implementation - **not yet wired into `AttachmentService`'s default
 * primary provider**. Adopting it (switching `AttachmentService`'s
 * default from `SupabaseStorageProvider` to this class) is a deliberate,
 * separate, explicitly-scoped follow-up - not something this pass does
 * silently. See `docs/adr/` for the eventual migration decision once made.
 *
 * **Never returns a permanent object URL** (R2 Production Readiness
 * Review, `docs/engineering/R2_PRODUCTION_READINESS.md` - the bucket's
 * public development URL made every object world-readable with no
 * signature). `upload()` returns only the identifying/metadata fields
 * (`locator`/`checksum`/`sizeBytes`) with `url: null` - the only way to
 * get a usable URL for an object is `getSignedUrl()`, called on demand by
 * `AttachmentService.getUrl()`. There is no `R2_PUBLIC_URL` config and no
 * code path in this class ever constructs an `*.r2.dev` (or any other
 * public bucket) URL.
 */
export class CloudflareR2Provider implements StorageProvider {
  readonly name = 'CLOUDFLARE_R2' as const;

  private readonly client: S3Client;
  private readonly bucket: string;

  /** `config`/`client` are injectable (default: real env-based config and
   *  a real `S3Client`) purely so unit tests can supply a fake client
   *  without needing real R2 credentials - every other constructor call
   *  site (there are none yet - see the class doc comment) uses the
   *  defaults. */
  constructor(config: R2Config = getR2Config(), client?: S3Client) {
    this.bucket = config.bucket;
    this.client =
      client ??
      new S3Client({
        region: 'auto',
        endpoint: r2Endpoint(config.accountId),
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
  }

  async upload(params: { path: string; buffer: Buffer; mimeType: string }): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.path,
        Body: params.buffer,
        ContentType: params.mimeType,
      })
    );
    return {
      locator: params.path,
      checksum: sha256Hex(params.buffer),
      sizeBytes: params.buffer.byteLength,
      // Never a permanent/public URL - see class doc comment.
      url: null,
    };
  }

  async download(locator: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: locator }));
    if (!res.Body) throw new Error(`R2 download failed: no body for ${locator}`);
    return streamToBuffer(res.Body);
  }

  async delete(locator: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: locator }));
  }

  async exists(locator: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: locator }));
      return true;
    } catch (err) {
      if (err instanceof NotFound) return false;
      throw err;
    }
  }

  async getSignedUrl(locator: string, _mimeType: string, expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<{ url: string; expiresAt: string | null }> {
    const url = await presignS3Url(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: locator }), {
      expiresIn: expiresInSeconds,
    });
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken })
      );
      keys.push(...(res.Contents ?? []).map((o) => o.Key).filter((key): key is string => !!key));
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  }

  /** Signed *upload* URL, mirroring `SupabaseStorageProvider.createSignedUploadUrl()` -
   *  a large file PUTs directly to R2, bypassing our own API route's body-size cap. */
  async createSignedUploadUrl(path: string): Promise<{ signedUrl: string; token: string }> {
    const signedUrl = await presignS3Url(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: path }), {
      expiresIn: DEFAULT_SIGNED_URL_TTL_SECONDS,
    });
    // R2/S3 presigned PUT URLs carry every credential/expiry param needed
    // in the URL itself - there's no separate "token" the way Supabase's
    // `createSignedUploadUrl()` returns one. Kept as an empty string so
    // callers built against the shared shape don't need a branch.
    return { signedUrl, token: '' };
  }

  async statObject(path: string): Promise<{ sizeBytes: number } | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: path }));
      return { sizeBytes: res.ContentLength ?? 0 };
    } catch (err) {
      if (err instanceof NotFound) return null;
      throw err;
    }
  }
}

/**
 * Cloudflare R2 configuration - read lazily (not at module load) so this
 * file can be imported anywhere without throwing in an environment that
 * doesn't set these vars (e.g. running tests, or before R2 is actually
 * provisioned). Mirrors the existing `getSupabase()`/`oauthClient()`
 * pattern in `lib/supabase.ts`/`lib/googleDrive.ts` - read once, throw a
 * clear error naming the missing var, never silently default.
 */
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is not set`);
  return value;
}

/** No `publicUrl`/`R2_PUBLIC_URL` here - the R2 Production Readiness
 *  Review found this bucket's public development URL made every object
 *  world-readable with no signature (`docs/engineering/R2_PRODUCTION_READINESS.md`).
 *  `CloudflareR2Provider` never constructs a public object URL, so this
 *  config never needs one. `R2_PUBLIC_URL` may still be present in an
 *  existing `.env.local` from before this fix - it's simply unread now,
 *  not an error, and should be removed from any environment when
 *  convenient. */
export function getR2Config(): R2Config {
  return {
    accountId: requireEnv('R2_ACCOUNT_ID'),
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    bucket: requireEnv('R2_BUCKET'),
  };
}

/** R2's S3-compatible endpoint - see
 *  https://developers.cloudflare.com/r2/api/s3/api/. */
export function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

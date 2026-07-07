/**
 * Chooses which `StorageProvider` implementation `AttachmentService` wires
 * up for its primary and archive roles, from configuration
 * (`STORAGE_PROVIDER`/`ARCHIVE_PROVIDER`) rather than a hardcoded `new
 * SomeProvider()` in `AttachmentService` itself. This is the seam a future
 * migration (e.g. switching primary storage to Cloudflare R2) goes
 * through - a config change, not a code change to `AttachmentService` or
 * any business module. See `docs/architecture/STORAGE_PLATFORM.md`.
 *
 * Unset env vars default to today's real, unchanged behavior: Supabase
 * primary, Google Drive archive - the factory does not change what
 * happens when nothing is configured.
 */
import { StorageProvider } from './StorageProvider';
import { StorageProviderName } from './types';
import { SupabaseStorageProvider } from './SupabaseStorageProvider';
import { GoogleDriveStorageProvider } from './GoogleDriveStorageProvider';
import { CloudflareR2Provider } from './CloudflareR2Provider';

const SUPPORTED_PROVIDERS: readonly StorageProviderName[] = ['SUPABASE', 'CLOUDFLARE_R2', 'GOOGLE_DRIVE'];

const DEFAULT_STORAGE_PROVIDER: StorageProviderName = 'SUPABASE';
const DEFAULT_ARCHIVE_PROVIDER: StorageProviderName = 'GOOGLE_DRIVE';

function isSupportedProvider(value: string): value is StorageProviderName {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

/** Reads one env var, validating it against the supported provider names -
 *  throws a clear, named error rather than silently falling back, so a
 *  typo'd env var fails loudly at startup instead of quietly running on
 *  the wrong backend. Returns `fallback` only when the var is unset
 *  entirely (this is what preserves today's default behavior). */
function resolveProviderName(envVar: string, fallback: StorageProviderName): StorageProviderName {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  const value = raw.trim().toUpperCase();
  if (!isSupportedProvider(value)) {
    throw new Error(`${envVar}="${raw}" is not a supported storage provider - expected one of: ${SUPPORTED_PROVIDERS.join(', ')}`);
  }
  return value;
}

/** Constructs the concrete provider for a resolved name. Throws whatever
 *  the provider's own constructor throws for missing configuration (e.g.
 *  `CloudflareR2Provider`'s `getR2Config()` naming the specific missing
 *  `R2_*` var) - wrapped here with the provider name and which role
 *  (primary/archive) it was being built for, so a misconfiguration is
 *  traceable to *why* a provider was being constructed at all. */
function instantiate(name: StorageProviderName, role: 'primary' | 'archive'): StorageProvider {
  try {
    switch (name) {
      case 'SUPABASE':
        return new SupabaseStorageProvider();
      case 'GOOGLE_DRIVE':
        return new GoogleDriveStorageProvider();
      case 'CLOUDFLARE_R2':
        return new CloudflareR2Provider();
      default: {
        // Exhaustiveness guard - unreachable while StorageProviderName and
        // SUPPORTED_PROVIDERS stay in sync (a new provider name added to one
        // without the other is a compile error here, not a silent gap).
        const exhaustive: never = name;
        throw new Error(`Unhandled storage provider: ${exhaustive}`);
      }
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to configure ${role} storage provider "${name}": ${reason}`);
  }
}

export const StorageProviderFactory = {
  /** Env var name -> supported provider name mapping, exposed for tests
   *  and for anything that wants to display/validate configuration
   *  without actually constructing a provider. */
  SUPPORTED_PROVIDERS,

  createPrimaryProvider(): StorageProvider {
    const name = resolveProviderName('STORAGE_PROVIDER', DEFAULT_STORAGE_PROVIDER);
    return instantiate(name, 'primary');
  },

  createArchiveProvider(): StorageProvider {
    const name = resolveProviderName('ARCHIVE_PROVIDER', DEFAULT_ARCHIVE_PROVIDER);
    // R2 Production Readiness Review blocker #3
    // (docs/engineering/R2_PRODUCTION_READINESS.md): AttachmentService.getUrl()
    // only ever resolves an ARCHIVED attachment's URL via its stored
    // `driveUrl` column - it never calls an archive provider's
    // getSignedUrl(). CloudflareR2Provider deliberately never returns a
    // permanent URL (see its own doc comment), so an R2-archived
    // attachment would have no `driveUrl` to fall back to and would
    // become permanently unreachable via getUrl(). Rejected here, at
    // configuration time, rather than left as a silent runtime gap -
    // teaching getUrl() to sign against a non-Drive archive provider is a
    // real feature, not something this hardening pass adds.
    if (name === 'CLOUDFLARE_R2') {
      throw new Error(
        'ARCHIVE_PROVIDER="CLOUDFLARE_R2" is not supported yet - AttachmentService.getUrl() cannot resolve a signed URL for a non-Drive archive provider. See docs/engineering/R2_PRODUCTION_READINESS.md, blocker #3.'
      );
    }
    return instantiate(name, 'archive');
  },
};

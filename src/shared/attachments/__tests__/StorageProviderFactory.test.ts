import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageProviderFactory } from '../StorageProviderFactory';
import { SupabaseStorageProvider } from '../SupabaseStorageProvider';
import { GoogleDriveStorageProvider } from '../GoogleDriveStorageProvider';
import { CloudflareR2Provider } from '../CloudflareR2Provider';

const ENV_KEYS = ['STORAGE_PROVIDER', 'ARCHIVE_PROVIDER', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function setR2Env() {
  process.env.R2_ACCOUNT_ID = 'acct-1';
  process.env.R2_ACCESS_KEY_ID = 'key-1';
  process.env.R2_SECRET_ACCESS_KEY = 'secret-1';
  process.env.R2_BUCKET = 'test-bucket';
}

describe('StorageProviderFactory - default configuration', () => {
  it('creates SupabaseStorageProvider as primary and GoogleDriveStorageProvider as archive when nothing is configured', () => {
    const primary = StorageProviderFactory.createPrimaryProvider();
    const archive = StorageProviderFactory.createArchiveProvider();

    expect(primary).toBeInstanceOf(SupabaseStorageProvider);
    expect(primary.name).toBe('SUPABASE');
    expect(archive).toBeInstanceOf(GoogleDriveStorageProvider);
    expect(archive.name).toBe('GOOGLE_DRIVE');
  });
});

describe('StorageProviderFactory - Cloudflare primary', () => {
  it('creates a CloudflareR2Provider when STORAGE_PROVIDER=CLOUDFLARE_R2 and R2 config is present', () => {
    process.env.STORAGE_PROVIDER = 'CLOUDFLARE_R2';
    setR2Env();

    const primary = StorageProviderFactory.createPrimaryProvider();

    expect(primary).toBeInstanceOf(CloudflareR2Provider);
    expect(primary.name).toBe('CLOUDFLARE_R2');
  });

  it('accepts a lowercase env value', () => {
    process.env.STORAGE_PROVIDER = 'cloudflare_r2';
    setR2Env();

    const primary = StorageProviderFactory.createPrimaryProvider();

    expect(primary).toBeInstanceOf(CloudflareR2Provider);
  });
});

describe('StorageProviderFactory - Google archive', () => {
  it('creates a GoogleDriveStorageProvider when ARCHIVE_PROVIDER=GOOGLE_DRIVE is set explicitly', () => {
    process.env.ARCHIVE_PROVIDER = 'GOOGLE_DRIVE';

    const archive = StorageProviderFactory.createArchiveProvider();

    expect(archive).toBeInstanceOf(GoogleDriveStorageProvider);
  });

  it('allows the archive provider to be Supabase instead, if ever configured that way', () => {
    process.env.ARCHIVE_PROVIDER = 'SUPABASE';

    const archive = StorageProviderFactory.createArchiveProvider();

    expect(archive).toBeInstanceOf(SupabaseStorageProvider);
  });
});

describe('StorageProviderFactory - invalid provider', () => {
  it('throws a clear error for an unsupported STORAGE_PROVIDER value', () => {
    process.env.STORAGE_PROVIDER = 'AWS_S3';

    expect(() => StorageProviderFactory.createPrimaryProvider()).toThrow(/not a supported storage provider/);
  });

  it('throws a clear error for an unsupported ARCHIVE_PROVIDER value', () => {
    process.env.ARCHIVE_PROVIDER = 'DROPBOX';

    expect(() => StorageProviderFactory.createArchiveProvider()).toThrow(/not a supported storage provider/);
  });
});

describe('StorageProviderFactory - missing configuration', () => {
  it('throws, naming the primary role and the missing R2 var, when CLOUDFLARE_R2 is selected without R2 config', () => {
    process.env.STORAGE_PROVIDER = 'CLOUDFLARE_R2';

    expect(() => StorageProviderFactory.createPrimaryProvider()).toThrow(/Failed to configure primary storage provider "CLOUDFLARE_R2"/);
    expect(() => StorageProviderFactory.createPrimaryProvider()).toThrow(/R2_ACCOUNT_ID/);
  });

});

describe('StorageProviderFactory - CLOUDFLARE_R2 as archive provider is rejected (R2 Production Readiness Review blocker #3)', () => {
  it('throws even when full R2 config is present - not a missing-configuration error', () => {
    process.env.ARCHIVE_PROVIDER = 'CLOUDFLARE_R2';
    setR2Env();

    expect(() => StorageProviderFactory.createArchiveProvider()).toThrow(/ARCHIVE_PROVIDER="CLOUDFLARE_R2" is not supported yet/);
  });

  it('throws without R2 config too - the unsupported-role rejection happens before provider construction', () => {
    process.env.ARCHIVE_PROVIDER = 'CLOUDFLARE_R2';

    expect(() => StorageProviderFactory.createArchiveProvider()).toThrow(/ARCHIVE_PROVIDER="CLOUDFLARE_R2" is not supported yet/);
  });

  it('does not reject CLOUDFLARE_R2 as the primary provider - only the archive role is restricted', () => {
    process.env.STORAGE_PROVIDER = 'CLOUDFLARE_R2';
    setR2Env();

    expect(() => StorageProviderFactory.createPrimaryProvider()).not.toThrow();
  });
});

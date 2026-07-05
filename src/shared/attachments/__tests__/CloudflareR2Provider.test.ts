import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { NotFound } from '@aws-sdk/client-s3';

const presignMock = vi.fn();
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => presignMock(...args),
}));

import { CloudflareR2Provider } from '../CloudflareR2Provider';
import { R2Config } from '../r2Config';

const config: R2Config = {
  accountId: 'acct-1',
  accessKeyId: 'key-1',
  secretAccessKey: 'secret-1',
  bucket: 'test-bucket',
};

function makeClient() {
  return { send: vi.fn() };
}

describe('CloudflareR2Provider.upload', () => {
  it('uploads via PutObjectCommand and returns checksum/size only - never a permanent URL', async () => {
    const client = makeClient();
    client.send.mockResolvedValue({});
    const provider = new CloudflareR2Provider(config, client as any);

    const result = await provider.upload({ path: 'pm/pm_record/rec-1/photo.jpg', buffer: Buffer.from('hello'), mimeType: 'image/jpeg' });

    expect(client.send).toHaveBeenCalledTimes(1);
    expect(result.locator).toBe('pm/pm_record/rec-1/photo.jpg');
    expect(result.sizeBytes).toBe(5);
    expect(result.checksum).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    // R2 Production Readiness Review hardening: upload() must never return
    // a permanent/public URL - see the class doc comment.
    expect(result.url).toBeNull();
  });

  it('never constructs an *.r2.dev (or any other) URL string anywhere in its result', async () => {
    const client = makeClient();
    client.send.mockResolvedValue({});
    const provider = new CloudflareR2Provider(config, client as any);

    const result = await provider.upload({ path: 'pm/pm_record/rec-1/photo.jpg', buffer: Buffer.from('hello'), mimeType: 'image/jpeg' });

    expect(JSON.stringify(result)).not.toMatch(/https?:\/\//);
  });
});

describe('CloudflareR2Provider.download', () => {
  it('reads the object body stream into a Buffer', async () => {
    const client = makeClient();
    client.send.mockResolvedValue({ Body: Readable.from([Buffer.from('hello')]) });
    const provider = new CloudflareR2Provider(config, client as any);

    const buffer = await provider.download('some/key.jpg');

    expect(buffer.toString()).toBe('hello');
  });

  it('throws when the object has no body', async () => {
    const client = makeClient();
    client.send.mockResolvedValue({ Body: undefined });
    const provider = new CloudflareR2Provider(config, client as any);

    await expect(provider.download('missing/key.jpg')).rejects.toThrow();
  });
});

describe('CloudflareR2Provider.delete', () => {
  it('sends a DeleteObjectCommand for the locator', async () => {
    const client = makeClient();
    client.send.mockResolvedValue({});
    const provider = new CloudflareR2Provider(config, client as any);

    await provider.delete('some/key.jpg');

    expect(client.send).toHaveBeenCalledTimes(1);
  });
});

describe('CloudflareR2Provider.exists', () => {
  it('returns true when HeadObject succeeds', async () => {
    const client = makeClient();
    client.send.mockResolvedValue({ ContentLength: 100 });
    const provider = new CloudflareR2Provider(config, client as any);

    expect(await provider.exists('some/key.jpg')).toBe(true);
  });

  it('returns false when the object is not found', async () => {
    const client = makeClient();
    client.send.mockRejectedValue(new NotFound({ message: 'not found', $metadata: {} }));
    const provider = new CloudflareR2Provider(config, client as any);

    expect(await provider.exists('missing/key.jpg')).toBe(false);
  });

  it('rethrows any other error', async () => {
    const client = makeClient();
    client.send.mockRejectedValue(new Error('network error'));
    const provider = new CloudflareR2Provider(config, client as any);

    await expect(provider.exists('some/key.jpg')).rejects.toThrow('network error');
  });
});

describe('CloudflareR2Provider.getSignedUrl', () => {
  beforeEach(() => presignMock.mockReset());

  it('returns a presigned URL with an expiry timestamp', async () => {
    presignMock.mockResolvedValue('https://presigned.example/get?sig=abc');
    const provider = new CloudflareR2Provider(config, makeClient() as any);

    const result = await provider.getSignedUrl('some/key.jpg', 'image/jpeg', 120);

    expect(result.url).toBe('https://presigned.example/get?sig=abc');
    expect(result.expiresAt).not.toBeNull();
    expect(presignMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 120 });
  });
});

describe('CloudflareR2Provider.list', () => {
  it('paginates through every ListObjectsV2Command page', async () => {
    const client = makeClient();
    client.send
      .mockResolvedValueOnce({ Contents: [{ Key: 'pm/a.jpg' }], IsTruncated: true, NextContinuationToken: 'tok-1' })
      .mockResolvedValueOnce({ Contents: [{ Key: 'pm/b.jpg' }], IsTruncated: false });
    const provider = new CloudflareR2Provider(config, client as any);

    const keys = await provider.list('pm/');

    expect(keys).toEqual(['pm/a.jpg', 'pm/b.jpg']);
    expect(client.send).toHaveBeenCalledTimes(2);
  });
});

describe('CloudflareR2Provider.statObject', () => {
  it('returns sizeBytes from HeadObject', async () => {
    const client = makeClient();
    client.send.mockResolvedValue({ ContentLength: 42 });
    const provider = new CloudflareR2Provider(config, client as any);

    expect(await provider.statObject('some/key.jpg')).toEqual({ sizeBytes: 42 });
  });

  it('returns null when the object does not exist', async () => {
    const client = makeClient();
    client.send.mockRejectedValue(new NotFound({ message: 'not found', $metadata: {} }));
    const provider = new CloudflareR2Provider(config, client as any);

    expect(await provider.statObject('missing/key.jpg')).toBeNull();
  });
});

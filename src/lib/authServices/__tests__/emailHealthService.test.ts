import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface QueryResult {
  data: unknown[] | null;
  error: unknown;
}

function createQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (onFulfilled: (value: QueryResult) => unknown) => Promise.resolve(result).then(onFulfilled);
  return builder;
}

const mockFrom = vi.fn();
vi.mock('../../supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

describe('getEmailHealth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockFrom.mockReset();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('reports NotConfigured when RESEND_API_KEY is unset, regardless of send history', async () => {
    delete process.env.RESEND_API_KEY;
    mockFrom
      .mockReturnValueOnce(createQueryBuilder({ data: [], error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: [], error: null }));
    const { getEmailHealth } = await import('../emailHealthService');

    const health = await getEmailHealth();

    expect(health.configured).toBe(false);
    expect(health.status).toBe('NotConfigured');
  });

  it('reports Degraded when configured but still using the Resend sandbox sender - the leading suspect in the production incident', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    delete process.env.RESEND_FROM_EMAIL;
    mockFrom
      .mockReturnValueOnce(createQueryBuilder({ data: [], error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: [], error: null }));
    const { getEmailHealth } = await import('../emailHealthService');

    const health = await getEmailHealth();

    expect(health.usingSandboxSender).toBe(true);
    expect(health.sender).toBe('onboarding@resend.dev');
    expect(health.status).toBe('Degraded');
  });

  it('reports Degraded when the most recent send failed, even with a custom sender configured', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
    mockFrom
      .mockReturnValueOnce(createQueryBuilder({ data: [{ event_type: 'EMAIL_SEND_FAILURE', created_at: '2026-01-01T00:00:00Z' }], error: null }))
      .mockReturnValueOnce(
        createQueryBuilder({ data: [{ metadata: { errorMessage: 'invalid_from_address' }, created_at: '2026-01-01T00:00:00Z' }], error: null })
      );
    const { getEmailHealth } = await import('../emailHealthService');

    const health = await getEmailHealth();

    expect(health.status).toBe('Degraded');
    expect(health.lastSendOk).toBe(false);
    expect(health.lastFailureReason).toBe('invalid_from_address');
  });

  it('reports Healthy when configured, using a custom sender, and the last send succeeded', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
    mockFrom
      .mockReturnValueOnce(createQueryBuilder({ data: [{ event_type: 'EMAIL_SEND_SUCCESS', created_at: '2026-01-01T00:00:00Z' }], error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: [], error: null }));
    const { getEmailHealth } = await import('../emailHealthService');

    const health = await getEmailHealth();

    expect(health.status).toBe('Healthy');
    expect(health.lastSendOk).toBe(true);
  });
});

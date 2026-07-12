import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function Resend() {
    return { emails: { send: mockSend } };
  }),
}));
vi.mock('./authServices/auditService', () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));
// email.ts imports renderRecordPdf from './exportPdf' (a .tsx react-pdf
// component) purely for sendRecordNotification, which this file doesn't
// test - mocked out so this test doesn't need react-pdf's JSX pipeline.
vi.mock('./exportPdf', () => ({
  renderRecordPdf: vi.fn(),
}));

import { sendImportCompletionEmail, sendInvitationEmail } from './email';

describe('email.ts HTML escaping (PR #36 security fix regression)', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key';
    mockSend.mockClear();
  });

  describe('sendImportCompletionEmail - summary.filename', () => {
    const baseSummary = { imported: 1, skipped: 0, failed: 0, durationMs: 1000 };

    it('renders a normal filename unescaped-but-safe (no special characters to escape)', async () => {
      await sendImportCompletionEmail('a@b.com', { ...baseSummary, filename: 'ntr_legacy_import.xlsx' }, 'https://example.com/report');
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('ntr_legacy_import.xlsx');
      expect(call.subject).toContain('ntr_legacy_import.xlsx');
    });

    it('escapes a filename containing an HTML tag', async () => {
      await sendImportCompletionEmail('a@b.com', { ...baseSummary, filename: '<img src=x onerror=alert(1)>.xlsx' }, 'https://example.com/report');
      const call = mockSend.mock.calls[0][0];
      expect(call.html).not.toContain('<img src=x onerror=alert(1)>');
      expect(call.html).toContain('&lt;img src=x onerror=alert(1)&gt;.xlsx');
      expect(call.subject).not.toContain('<img');
      expect(call.subject).toContain('&lt;img');
    });

    it('escapes a filename containing angle brackets alone', async () => {
      await sendImportCompletionEmail('a@b.com', { ...baseSummary, filename: '<script>.xlsx' }, 'https://example.com/report');
      const call = mockSend.mock.calls[0][0];
      expect(call.html).not.toContain('<script>');
      expect(call.html).toContain('&lt;script&gt;');
    });

    it('escapes a filename containing double and single quotes', async () => {
      await sendImportCompletionEmail('a@b.com', { ...baseSummary, filename: `report "final" 'v2'.xlsx` }, 'https://example.com/report');
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('&quot;final&quot;');
      expect(call.html).toContain('&#39;v2&#39;');
      expect(call.html).not.toContain(`"final"`);
    });

    it('escapes a filename containing an HTML entity (ampersand) without double-escaping', async () => {
      await sendImportCompletionEmail('a@b.com', { ...baseSummary, filename: 'Q1 & Q2 report.xlsx' }, 'https://example.com/report');
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Q1 &amp; Q2 report.xlsx');
      expect(call.html).not.toContain('Q1 & Q2 report.xlsx');
    });

    it('strips embedded CR/LF from the filename so it cannot inject extra header-like lines', async () => {
      await sendImportCompletionEmail('a@b.com', { ...baseSummary, filename: 'a\r\nBcc: attacker@evil.com\r\n.xlsx' }, 'https://example.com/report');
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).not.toMatch(/[\r\n]/);
      expect(call.html).not.toMatch(/[\r\n]{2,}Bcc:/);
    });
  });

  describe('sendInvitationEmail - fullName', () => {
    it('escapes a full name containing an HTML tag', async () => {
      await sendInvitationEmail('a@b.com', '<b>Bob</b>', 'https://example.com/invite');
      const call = mockSend.mock.calls[0][0];
      expect(call.html).not.toContain('<b>Bob</b>');
      expect(call.html).toContain('&lt;b&gt;Bob&lt;/b&gt;');
    });

    it('renders a normal full name unchanged', async () => {
      await sendInvitationEmail('a@b.com', 'Somchai Jaidee', 'https://example.com/invite');
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Somchai Jaidee');
    });
  });
});

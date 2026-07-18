import { Resend } from 'resend';
import { MqrRecord } from './types';
import { renderRecordPdf } from './exportPdf';
import { buildPdfFilename } from './pdf/filename';
import { logAuthEvent } from './authServices/auditService';

let client: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

/**
 * Escapes a plain-text value for safe interpolation into an HTML email
 * body (and, incidentally, a `Subject` header - also strips CR/LF so a
 * crafted value can't inject extra header lines). This repository has no
 * existing HTML-escaping utility (confirmed via a repo-wide search before
 * adding this one) and no templating engine that would escape by default
 * - every value interpolated into any of this file's hand-built HTML
 * strings must be passed through this first unless it's a server-
 * generated value with no user input in it (a reset/invite URL token, an
 * ISO timestamp, a numeric count). Found during the PR #36 security
 * review: `sendImportCompletionEmail()`'s `summary.filename` (the
 * uploader's own client-supplied file name) and `sendInvitationEmail()`'s
 * `fullName` were being interpolated unescaped.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\r\n]/g, ' ');
}

/** Per the spec (section 8): PDF report email fires at two points —
 *  "แจ้งซ่อม" (new record created) and "ปิดงาน" (job closed / repair result
 *  recorded). The recipient is the central/admin notification address. */
type NotifyKind = 'created' | 'closed';

const SUBJECT_PREFIX: Record<NotifyKind, string> = {
  created: 'แจ้งปัญหาคุณภาพใหม่',
  closed: 'ปิดงานซ่อม',
};

function buildHtml(record: MqrRecord, dealerName: string | undefined, kind: NotifyKind, recordUrl: string): string {
  const rows: [string, string][] = [
    ['เลขที่งาน', record.job_id],
    ['ดีลเลอร์', dealerName ?? record.dealer_id],
    ['รถ / Serial', `${record.model ?? '-'} (${record.serial ?? '-'})`],
    ['อาการที่พบ', record.problem_code ?? '-'],
    ['ความรุนแรง', record.severity ?? '-'],
    ['สถานะ', record.status],
    ['ลูกค้า', record.customer_name ?? '-'],
  ];
  // Every `value` here is either dealer/staff-entered free text
  // (customer_name, model/serial stock notes) or master data an admin
  // controls (dealerName) - none of it is safe to interpolate into HTML
  // unescaped (see `escapeHtml()`'s doc comment for why this file needs
  // its own escaping, not a templating engine).
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 10px;color:#666;white-space:nowrap">${label}</td><td style="padding:4px 10px">${escapeHtml(value)}</td></tr>`
    )
    .join('');
  return `
    <div style="font-family:sans-serif;font-size:14px;color:#1a1a1a">
      <h2 style="color:#9c1c1c;margin-bottom:4px">${SUBJECT_PREFIX[kind]} — ${escapeHtml(record.job_id)}</h2>
      <p style="color:#666;margin-top:0">ดูรายละเอียดฉบับเต็มในไฟล์ PDF ที่แนบมา หรือเปิดลิงก์ด้านล่าง</p>
      <table style="border-collapse:collapse;margin:12px 0">${rowsHtml}</table>
      <p><a href="${recordUrl}" style="color:#9c1c1c">เปิดรายงานในระบบ →</a></p>
    </div>
  `;
}

/**
 * Renders the record's PDF and emails it via Resend. Silently no-ops (with a
 * console.warn) if RESEND_API_KEY isn't configured, and never throws — a
 * failed/unconfigured notification email must never block the record
 * create/update request that triggered it.
 */
export async function sendRecordNotification(
  record: MqrRecord,
  dealerName: string | undefined,
  baseUrl: string,
  kind: NotifyKind
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('RESEND_API_KEY not set — skipping notification email');
    return;
  }
  const to = process.env.MQR_NOTIFY_EMAIL;
  if (!to) {
    console.warn('MQR_NOTIFY_EMAIL not set — skipping notification email');
    return;
  }
  try {
    const recordUrl = `${baseUrl}/records/${encodeURIComponent(record.job_id)}`;
    const pdf = await renderRecordPdf(record, baseUrl, dealerName);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject: `[MQR] ${SUBJECT_PREFIX[kind]} — ${record.job_id}`,
      html: buildHtml(record, dealerName, kind, recordUrl),
      attachments: [{ filename: buildPdfFilename(record.job_id), content: pdf }],
    });
  } catch (err) {
    console.error('sendRecordNotification error', err);
  }
}

// ---------- Import Platform v2 notification (ADR-022, Task 15) ----------

/** Sent once an import session finishes (`NtrImportService.commit()`,
 *  today's only real caller - any future module's import adopts this the
 *  same way). Reuses the exact "never throws, warn-and-skip if
 *  unconfigured" contract `sendRecordNotification()` above already
 *  established - an unconfigured/failed notification email must never
 *  block or fail an import that already committed. Deliberately not
 *  routed through `sendAuthEmail()`/`EmailKind` below - that machinery
 *  (structured result, `auth_audit_log` recording) is specific to the
 *  Authentication Platform; an import's own outcome is already recorded
 *  in `ntr_import_sessions`/`record_audit_log`, so this is a plain,
 *  fire-and-forget-safe notification, not a second audit trail. */
export async function sendImportCompletionEmail(
  to: string,
  summary: { filename: string; imported: number; skipped: number; failed: number; durationMs: number },
  reportUrl: string
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('RESEND_API_KEY not set — skipping import completion email');
    return;
  }
  try {
    // `summary.filename` is the uploader's own client-supplied file name
    // (`File.name` from the browser's multipart upload, stored verbatim
    // on the import session) - genuinely attacker-controlled text, not
    // server-generated. Found unescaped during the PR #36 security
    // review; every value below goes through `escapeHtml()`.
    const rows: [string, string][] = [
      ['ไฟล์', summary.filename],
      ['นำเข้าสำเร็จ', String(summary.imported)],
      ['ข้าม', String(summary.skipped)],
      ['ล้มเหลว', String(summary.failed)],
      ['ระยะเวลา', `${(summary.durationMs / 1000).toFixed(1)} วินาที`],
    ];
    const rowsHtml = rows
      .map(([label, value]) => `<tr><td style="padding:4px 10px;color:#666;white-space:nowrap">${label}</td><td style="padding:4px 10px">${escapeHtml(value)}</td></tr>`)
      .join('');
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject: `[MQR] นำเข้าข้อมูลเสร็จสิ้น — ${escapeHtml(summary.filename)}`,
      html: `
        <div style="font-family:sans-serif;font-size:14px;color:#1a1a1a">
          <h2 style="color:#9c1c1c;margin-bottom:4px">นำเข้าข้อมูลเสร็จสิ้น</h2>
          <table style="border-collapse:collapse;margin:12px 0">${rowsHtml}</table>
          <p><a href="${reportUrl}" style="color:#9c1c1c">เปิดรายงานการนำเข้า →</a></p>
        </div>
      `,
    });
  } catch (err) {
    console.error('sendImportCompletionEmail error', err);
  }
}

// ---------- Authentication Platform v3.0 email templates (spec section 12) ----------

/** Shared layout every auth email (Reset, Invitation, Password Changed,
 *  Account Locked, Test) renders through - reuses the same brand-red
 *  inline-style pattern `buildHtml()` above already established, rather
 *  than introducing a template engine/React Email for just these five. */
function buildEmailLayout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family:sans-serif;font-size:14px;color:#1a1a1a">
      <h2 style="color:#9c1c1c;margin-bottom:4px">${title}</h2>
      ${bodyHtml}
    </div>
  `;
}

// ---------- v3.0.1 reliability patch ----------
// The previous implementation awaited `resend.emails.send()` inside a
// try/catch and returned `void`. That looked safe but wasn't: the Resend
// SDK *resolves* (never throws) on provider-level failures - invalid/
// unverified `from` address, restricted API key, quota exceeded, etc. -
// returning `{ data: null, error: {...} }` instead. The old code never
// looked at `error`, so a provider rejection was indistinguishable from
// success. Every caller now gets a structured `EmailSendResult` back
// instead of `void`, and every outcome (success or failure) is recorded
// to `auth_audit_log` so it's never silently lost (Issue 6).

/** How long to wait for the provider before treating the send as timed
 *  out. Required once callers `await` this (Issue 1's fix) instead of
 *  firing-and-forgetting it - without a bound, an unreachable provider
 *  could hang the request indefinitely. */
const EMAIL_SEND_TIMEOUT_MS = 10_000;

export type EmailKind = 'password_reset' | 'invitation' | 'password_changed' | 'account_locked' | 'test';

export interface EmailSendResult {
  ok: boolean;
  provider: 'resend';
  /** Whether RESEND_API_KEY was set at all - `false` means no send was
   *  even attempted. */
  configured: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
  timedOut?: boolean;
  durationMs: number;
}

class EmailTimeoutError extends Error {
  constructor(ms: number) {
    super(`email provider did not respond within ${ms}ms`);
    this.name = 'EmailTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new EmailTimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** Records every send outcome - success or failure - to the
 *  Authentication Platform's audit trail. Backs the Email Health service
 *  (`emailHealthService.ts`, Issue 3) and the admin Users table's "Email
 *  Verified" column (Issue 5). Never throws - `logAuthEvent` already
 *  guarantees that. */
async function recordEmailOutcome(result: EmailSendResult, kind: EmailKind, to: string, userId?: string): Promise<void> {
  await logAuthEvent(result.ok ? 'EMAIL_SEND_SUCCESS' : 'EMAIL_SEND_FAILURE', {
    userId: userId ?? null,
    metadata: { kind, to, ...result },
  });
}

/** Never throws - same contract as before - but now returns a structured
 *  `EmailSendResult` instead of `void`, and always records its own
 *  outcome (Issue 2 + Issue 6). Callers must `await` this call itself
 *  (never `.catch(() => {})` and move on - see `authServices/
 *  reliability.ts`) so the send and its audit record are both guaranteed
 *  to finish before the response is returned. */
async function sendAuthEmail(to: string, subject: string, html: string, kind: EmailKind, userId?: string): Promise<EmailSendResult> {
  const startedAt = Date.now();
  const resend = getResend();
  if (!resend) {
    const result: EmailSendResult = {
      ok: false,
      provider: 'resend',
      configured: false,
      errorCode: 'NOT_CONFIGURED',
      errorMessage: 'RESEND_API_KEY not set',
      durationMs: Date.now() - startedAt,
    };
    console.warn('[auth email] skipped - RESEND_API_KEY not set', { kind, to });
    await recordEmailOutcome(result, kind, to, userId);
    return result;
  }

  try {
    const response = await withTimeout(
      resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to,
        subject,
        html,
      }),
      EMAIL_SEND_TIMEOUT_MS
    );
    const durationMs = Date.now() - startedAt;
    // The SDK resolves (never throws) on a provider-level error - `await`
    // alone does not mean the email was accepted. `response.error` must
    // be checked explicitly (Issue 2).
    if (response.error) {
      const result: EmailSendResult = {
        ok: false,
        provider: 'resend',
        configured: true,
        errorCode: response.error.name,
        errorMessage: response.error.message,
        durationMs,
      };
      console.error('[auth email] provider returned an error', { kind, to, ...result });
      await recordEmailOutcome(result, kind, to, userId);
      return result;
    }
    const result: EmailSendResult = {
      ok: true,
      provider: 'resend',
      configured: true,
      messageId: response.data?.id,
      durationMs,
    };
    await recordEmailOutcome(result, kind, to, userId);
    return result;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const timedOut = err instanceof EmailTimeoutError;
    const result: EmailSendResult = {
      ok: false,
      provider: 'resend',
      configured: true,
      timedOut,
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs,
    };
    console.error('[auth email] send failed', { kind, to, ...result });
    await recordEmailOutcome(result, kind, to, userId);
    return result;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, userId?: string): Promise<EmailSendResult> {
  return sendAuthEmail(
    to,
    '[MQR] คำขอตั้งรหัสผ่านใหม่',
    buildEmailLayout(
      'ตั้งรหัสผ่านใหม่',
      `
        <p>มีการร้องขอตั้งรหัสผ่านใหม่สำหรับบัญชี MQR ของคุณ</p>
        <p><a href="${resetUrl}" style="color:#9c1c1c">คลิกที่นี่เพื่อตั้งรหัสผ่านใหม่ →</a></p>
        <p style="color:#666;font-size:12px">ลิงก์นี้จะหมดอายุภายใน 30 นาทีและใช้ได้เพียงครั้งเดียว หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
      `
    ),
    'password_reset',
    userId
  );
}

export async function sendInvitationEmail(to: string, fullName: string, inviteUrl: string, userId?: string): Promise<EmailSendResult> {
  return sendAuthEmail(
    to,
    '[MQR] คุณได้รับเชิญให้เข้าใช้งานระบบ',
    buildEmailLayout(
      'คำเชิญเข้าใช้งานระบบ MQR',
      `
        <p>สวัสดีคุณ ${escapeHtml(fullName)}</p>
        <p>ผู้ดูแลระบบได้สร้างบัญชีให้คุณในระบบ Market Quality Report</p>
        <p><a href="${inviteUrl}" style="color:#9c1c1c">คลิกที่นี่เพื่อตั้งรหัสผ่านและเปิดใช้งานบัญชี →</a></p>
        <p style="color:#666;font-size:12px">ลิงก์นี้จะหมดอายุภายใน 7 วันและใช้ได้เพียงครั้งเดียว</p>
      `
    ),
    'invitation',
    userId
  );
}

export async function sendPasswordChangedEmail(to: string, userId?: string): Promise<EmailSendResult> {
  return sendAuthEmail(
    to,
    '[MQR] รหัสผ่านของคุณถูกเปลี่ยน',
    buildEmailLayout(
      'รหัสผ่านถูกเปลี่ยนแล้ว',
      `
        <p>รหัสผ่านสำหรับบัญชี MQR ของคุณเพิ่งถูกเปลี่ยน</p>
        <p style="color:#666;font-size:12px">หากคุณไม่ได้เป็นผู้ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบทันที</p>
      `
    ),
    'password_changed',
    userId
  );
}

export async function sendAccountLockedEmail(to: string, lockoutMinutes: number, userId?: string): Promise<EmailSendResult> {
  return sendAuthEmail(
    to,
    '[MQR] บัญชีของคุณถูกล็อกชั่วคราว',
    buildEmailLayout(
      'บัญชีถูกล็อกชั่วคราว',
      `
        <p>บัญชี MQR ของคุณถูกล็อกชั่วคราวเนื่องจากมีการเข้าสู่ระบบผิดพลาดหลายครั้งติดต่อกัน</p>
        <p>คุณสามารถลองเข้าสู่ระบบใหม่ได้ภายใน ${lockoutMinutes} นาที หรือติดต่อผู้ดูแลระบบเพื่อปลดล็อกบัญชี</p>
        <p style="color:#666;font-size:12px">หากคุณไม่ได้เป็นผู้พยายามเข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบ</p>
      `
    ),
    'account_locked',
    userId
  );
}

/** Admin Test Email (Issue 4) - exercises the exact same `sendAuthEmail`
 *  path (provider, sender, timeout, structured result, audit record) as
 *  every real auth email, so a successful test is real evidence the
 *  configuration works, not a separate, unrepresentative code path. */
export async function sendTestEmail(to: string, userId?: string): Promise<EmailSendResult> {
  return sendAuthEmail(
    to,
    '[MQR] อีเมลทดสอบจาก Email Health',
    buildEmailLayout(
      'อีเมลทดสอบ',
      `
        <p>นี่คืออีเมลทดสอบจากหน้า Email Health ของระบบ MQR เพื่อยืนยันว่าการตั้งค่าการส่งอีเมลทำงานถูกต้อง</p>
        <p style="color:#666;font-size:12px">ส่งเมื่อ ${new Date().toISOString()}</p>
      `
    ),
    'test',
    userId
  );
}

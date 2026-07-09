import { Resend } from 'resend';
import { MqrRecord } from './types';
import { renderRecordPdf } from './exportPdf';

let client: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
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
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 10px;color:#666;white-space:nowrap">${label}</td><td style="padding:4px 10px">${value}</td></tr>`
    )
    .join('');
  return `
    <div style="font-family:sans-serif;font-size:14px;color:#1a1a1a">
      <h2 style="color:#9c1c1c;margin-bottom:4px">${SUBJECT_PREFIX[kind]} — ${record.job_id}</h2>
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
    const safeJobId = record.job_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject: `[MQR] ${SUBJECT_PREFIX[kind]} — ${record.job_id}`,
      html: buildHtml(record, dealerName, kind, recordUrl),
      attachments: [{ filename: `${safeJobId}.pdf`, content: pdf }],
    });
  } catch (err) {
    console.error('sendRecordNotification error', err);
  }
}

// ---------- Authentication Platform v3.0 email templates (spec section 12) ----------

/** Shared layout every auth email (Reset, Invitation, Password Changed,
 *  Account Locked) renders through - reuses the same brand-red inline-
 *  style pattern `buildHtml()` above already established, rather than
 *  introducing a template engine/React Email for just these four. */
function buildEmailLayout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family:sans-serif;font-size:14px;color:#1a1a1a">
      <h2 style="color:#9c1c1c;margin-bottom:4px">${title}</h2>
      ${bodyHtml}
    </div>
  `;
}

/** Never throws, never blocks the caller - same contract as
 *  `sendRecordNotification` above. Every auth email function below wraps
 *  this once instead of repeating the try/catch + no-op-when-unconfigured
 *  boilerplate four times. */
async function sendAuthEmail(to: string, subject: string, html: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn('RESEND_API_KEY not set — skipping auth email:', subject);
    return;
  }
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('sendAuthEmail error', err);
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendAuthEmail(
    to,
    '[MQR] คำขอตั้งรหัสผ่านใหม่',
    buildEmailLayout(
      'ตั้งรหัสผ่านใหม่',
      `
        <p>มีการร้องขอตั้งรหัสผ่านใหม่สำหรับบัญชี MQR ของคุณ</p>
        <p><a href="${resetUrl}" style="color:#9c1c1c">คลิกที่นี่เพื่อตั้งรหัสผ่านใหม่ →</a></p>
        <p style="color:#666;font-size:12px">ลิงก์นี้จะหมดอายุภายใน 30 นาทีและใช้ได้เพียงครั้งเดียว หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
      `
    )
  );
}

export async function sendPasswordChangedEmail(to: string): Promise<void> {
  await sendAuthEmail(
    to,
    '[MQR] รหัสผ่านของคุณถูกเปลี่ยน',
    buildEmailLayout(
      'รหัสผ่านถูกเปลี่ยนแล้ว',
      `
        <p>รหัสผ่านสำหรับบัญชี MQR ของคุณเพิ่งถูกเปลี่ยน</p>
        <p style="color:#666;font-size:12px">หากคุณไม่ได้เป็นผู้ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบทันที</p>
      `
    )
  );
}

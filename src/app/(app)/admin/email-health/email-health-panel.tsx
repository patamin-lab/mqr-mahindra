'use client';

import { useState } from 'react';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalLoading, swalClose, swalError, swalSuccess } from '@/lib/swal';
import type { EmailHealthStatus } from '@/lib/authServices/emailHealthService';
import type { EmailSendResult } from '@/lib/email';
import { formatDateTimeLocalized } from '@/lib/thaiDate';

const STATUS_LABEL: Record<EmailHealthStatus['status'], string> = {
  NotConfigured: 'ยังไม่ได้ตั้งค่า',
  Degraded: 'ทำงานได้บางส่วน (ควรตรวจสอบ)',
  Healthy: 'ปกติ',
};

const STATUS_COLOR: Record<EmailHealthStatus['status'], string> = {
  NotConfigured: 'bg-gray-100 text-gray-600',
  Degraded: 'bg-amber-100 text-amber-700',
  Healthy: 'bg-green-100 text-green-700',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  return formatDateTimeLocalized(iso, 'th');
}

export default function EmailHealthPanel({ initialHealth }: { initialHealth: EmailHealthStatus }) {
  const [health, setHealth] = useState(initialHealth);
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<EmailSendResult | null>(null);

  async function refreshHealth() {
    try {
      const json = await fetchJson<{ ok: boolean; health: EmailHealthStatus }>('/api/admin/email-health');
      if (json.ok) setHealth(json.health);
    } catch {
      // Best-effort refresh only - the page already has the health status
      // from initial server render; a failed refresh isn't itself an
      // error worth surfacing.
    }
  }

  async function sendTest() {
    setBusy(true);
    swalLoading('กำลังส่งอีเมลทดสอบ...');
    try {
      const json = await fetchJson<{ ok: boolean; result: EmailSendResult }>('/api/admin/email-health/test', {
        method: 'POST',
        body: JSON.stringify(testTo ? { to: testTo } : {}),
      });
      setLastTestResult(json.result);
      swalClose();
      if (json.result.ok) {
        await swalSuccess('ส่งอีเมลทดสอบสำเร็จ');
      } else {
        await swalError(`ส่งอีเมลทดสอบไม่สำเร็จ: ${json.result.errorMessage ?? 'ไม่ทราบสาเหตุ'}`);
      }
      await refreshHealth();
    } catch (err: any) {
      swalClose();
      const msg = err instanceof FetchJsonError ? err.message : err?.message ?? 'เกิดข้อผิดพลาด';
      await swalError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-brand-dark">สถานะ</h2>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[health.status]}`}>
            {STATUS_LABEL[health.status]}
          </span>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-gray-500">ผู้ให้บริการ (Provider)</dt>
            <dd className="font-mono">{health.provider}</dd>
          </div>
          <div>
            <dt className="text-gray-500">การตั้งค่า (Configuration)</dt>
            <dd>{health.configured ? 'ตั้งค่าแล้ว (RESEND_API_KEY)' : 'ยังไม่ได้ตั้งค่า RESEND_API_KEY'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">ผู้ส่ง (Sender)</dt>
            <dd className="font-mono">{health.sender}</dd>
          </div>
          <div>
            <dt className="text-gray-500">การยืนยันโดเมน (Verification)</dt>
            <dd>
              {health.usingSandboxSender
                ? 'ใช้ที่อยู่ทดสอบของ Resend (onboarding@resend.dev) - อาจส่งไปยังผู้รับอื่นไม่ได้ ควรตั้งค่า RESEND_FROM_EMAIL เป็นโดเมนที่ยืนยันแล้ว'
                : 'ใช้โดเมนที่กำหนดเอง (RESEND_FROM_EMAIL)'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">ส่งล่าสุด (Last Send)</dt>
            <dd>
              {formatDateTime(health.lastSendAt)}
              {health.lastSendOk !== null && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${health.lastSendOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {health.lastSendOk ? 'สำเร็จ' : 'ล้มเหลว'}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">ล้มเหลวล่าสุด (Last Failure)</dt>
            <dd>
              {formatDateTime(health.lastFailureAt)}
              {health.lastFailureReason && <div className="text-xs text-red-600">{health.lastFailureReason}</div>}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-brand-dark">ส่งอีเมลทดสอบ (Send Test Email)</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="border rounded px-2 py-1.5 text-sm flex-1"
            placeholder="อีเมลปลายทาง (ค่าเริ่มต้น: อีเมลของคุณ)"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button disabled={busy} onClick={sendTest} className="btn-primary whitespace-nowrap">
            ส่งอีเมลทดสอบ
          </button>
        </div>
        {lastTestResult && (
          <div className="text-xs text-gray-500">
            ผลล่าสุด: {lastTestResult.ok ? 'สำเร็จ' : `ล้มเหลว (${lastTestResult.errorCode ?? lastTestResult.errorMessage ?? '-'})`}
            {' · '}
            {lastTestResult.durationMs}ms
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJson, FetchJsonError, CSRF_HEADER, CSRF_HEADER_VALUE } from '@/lib/fetchJson';
import { swalConfirm, swalError, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { formatDateTimeLocalized } from '@/lib/thaiDate';

interface SessionRow {
  session_id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  approx_location: string | null;
  last_activity: string;
  created_at: string;
}

/** Active Sessions (spec section 5, Profile -> Security -> Active
 *  Sessions). Device/Browser/OS/IP/Location/Login Time/Last Activity,
 *  Current Session badge, and the 4 logout actions the spec lists. */
export default function ActiveSessionsSection() {
  const { locale } = useTranslation();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const json = await fetchJson<{ ok: boolean; sessions: SessionRow[]; currentSessionId: string }>('/api/auth/sessions');
      setSessions(json.sessions);
      setCurrentSessionId(json.currentSessionId);
    } catch (err: any) {
      await swalError(err?.message ?? 'โหลดรายการเซสชันไม่สำเร็จ');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function clearOwnCookieAndRedirect() {
    await fetch('/api/auth/logout', { method: 'POST', headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE } });
    router.push('/login');
    router.refresh();
  }

  async function revokeOne(sessionId: string, isCurrent: boolean) {
    // "Require confirmation before terminating the current session" (spec
    // section 5) - applied to every row, current or not, since logging out
    // any other device is a meaningful action too.
    const confirmed = await swalConfirm(
      isCurrent ? 'ออกจากระบบอุปกรณ์นี้?' : 'ออกจากระบบอุปกรณ์นี้ (เซสชันอื่น)?',
      { title: 'ยืนยันการออกจากระบบ', confirmText: 'ออกจากระบบ' }
    );
    if (!confirmed) return;
    setBusy(true);
    swalLoading('กำลังดำเนินการ...');
    try {
      await fetchJson<{ ok: boolean; wasCurrent: boolean }>(`/api/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {
        method: 'POST',
      });
      swalClose();
      if (isCurrent) {
        await clearOwnCookieAndRedirect();
        return;
      }
      swalSuccessToast('ออกจากระบบอุปกรณ์นั้นแล้ว');
      await load();
    } catch (err: any) {
      swalClose();
      const msg = err instanceof FetchJsonError ? err.message : err?.message ?? 'เกิดข้อผิดพลาด';
      await swalError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function revokeAllOthers() {
    const confirmed = await swalConfirm('ออกจากระบบทุกอุปกรณ์อื่น (ยกเว้นอุปกรณ์นี้)?', {
      title: 'ยืนยันการดำเนินการ',
      confirmText: 'ออกจากระบบอุปกรณ์อื่นทั้งหมด',
    });
    if (!confirmed) return;
    setBusy(true);
    swalLoading('กำลังดำเนินการ...');
    try {
      await fetchJson<{ ok: boolean }>('/api/auth/sessions/revoke-others', { method: 'POST' });
      swalClose();
      swalSuccessToast('ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว');
      await load();
    } catch (err: any) {
      swalClose();
      const msg = err instanceof FetchJsonError ? err.message : err?.message ?? 'เกิดข้อผิดพลาด';
      await swalError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function revokeAll() {
    // Includes the current session (spec section 5's "Logout all
    // sessions") - require confirmation, same as the single-current-
    // session case, since this also logs the requester out.
    const confirmed = await swalConfirm('ออกจากระบบทุกอุปกรณ์ รวมถึงอุปกรณ์นี้ด้วย?', {
      title: 'ยืนยันการดำเนินการ',
      confirmText: 'ออกจากระบบทุกอุปกรณ์',
    });
    if (!confirmed) return;
    setBusy(true);
    swalLoading('กำลังดำเนินการ...');
    try {
      await fetchJson<{ ok: boolean }>('/api/auth/sessions/revoke-all', { method: 'POST' });
      swalClose();
      await clearOwnCookieAndRedirect();
    } catch (err: any) {
      swalClose();
      const msg = err instanceof FetchJsonError ? err.message : err?.message ?? 'เกิดข้อผิดพลาด';
      await swalError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (sessions === null) {
    return <p className="text-sm text-gray-400">กำลังโหลด...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={revokeAllOthers} className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
          ออกจากระบบอุปกรณ์อื่นทั้งหมด
        </button>
        <button disabled={busy} onClick={revokeAll} className="text-sm px-3 py-1.5 rounded border border-red-300 text-red-600 hover:bg-red-50">
          ออกจากระบบทุกอุปกรณ์
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400">ไม่มีเซสชันที่ใช้งานอยู่</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const isCurrent = s.session_id === currentSessionId;
            return (
              <li key={s.session_id} className="border border-gray-200 rounded-lg p-3 flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm min-w-0">
                  <div className="font-medium text-brand-dark flex items-center gap-2">
                    {s.device_name ?? 'Unknown device'} · {s.browser ?? 'Unknown browser'} · {s.os ?? 'Unknown OS'}
                    {isCurrent && <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">อุปกรณ์นี้</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {s.ip_address ?? '-'}
                    {s.approx_location ? ` · ${s.approx_location}` : ''}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    เข้าสู่ระบบ: {formatDateTimeLocalized(s.created_at, locale)} · ใช้งานล่าสุด: {formatDateTimeLocalized(s.last_activity, locale)}
                  </div>
                </div>
                <button
                  disabled={busy}
                  onClick={() => revokeOne(s.session_id, isCurrent)}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 shrink-0"
                >
                  ออกจากระบบ
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

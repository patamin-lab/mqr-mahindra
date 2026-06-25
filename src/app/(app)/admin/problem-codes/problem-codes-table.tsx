'use client';

import { useState } from 'react';
import { ProblemCode, Severity, SEVERITY_VALUES, SEVERITY_LABELS } from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError } from '@/lib/swal';

const SYSTEM_LABEL: Record<'powertrain' | 'other', string> = {
  powertrain: 'Powertrain (48 เดือน)',
  other: 'อื่นๆ (24 เดือน)',
};

type Draft = Partial<{
  code: string | null;
  label: string;
  groupName: string;
  system: 'powertrain' | 'other';
  defaultSeverity: Severity | null;
}>;

export default function ProblemCodesTable({ initial }: { initial: ProblemCode[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [newRow, setNewRow] = useState({
    code: '',
    label: '',
    groupName: '',
    system: 'other' as 'powertrain' | 'other',
    defaultSeverity: '' as '' | Severity,
  });

  async function showError(err: any) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    } else {
      await swalError(err?.message ?? 'เกิดข้อผิดพลาด');
    }
  }

  async function create() {
    setBusy(true);
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; problemCode: ProblemCode }>('/api/admin/problem-codes', {
        method: 'POST',
        body: JSON.stringify({ ...newRow, defaultSeverity: newRow.defaultSeverity || null }),
      });
      if (!json.ok) throw new Error(json.error);
      setRows((prev) => [...prev, json.problemCode]);
      setNewRow({ code: '', label: '', groupName: '', system: 'other', defaultSeverity: '' });
    } catch (err: any) {
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Draft & { active?: boolean }) {
    setBusy(true);
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; problemCode: ProblemCode }>(`/api/admin/problem-codes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!json.ok) throw new Error(json.error);
      setRows((prev) => prev.map((r) => (r.id === id ? json.problemCode : r)));
      setEditingId(null);
      setDraft({});
    } catch (err: any) {
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">รหัส</label>
          <input
            className="border rounded px-2 py-1.5 text-sm w-full"
            value={newRow.code}
            onChange={(e) => setNewRow({ ...newRow, code: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">หมวดหมู่ (Category)</label>
          <input
            className="border rounded px-2 py-1.5 text-sm w-full"
            value={newRow.groupName}
            onChange={(e) => setNewRow({ ...newRow, groupName: e.target.value })}
            placeholder="เช่น เครื่องยนต์"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">อาการเสีย (Sub-category)</label>
          <input
            className="border rounded px-2 py-1.5 text-sm w-full"
            value={newRow.label}
            onChange={(e) => setNewRow({ ...newRow, label: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ระบบ</label>
          <select
            className="border rounded px-2 py-1.5 text-sm w-full"
            value={newRow.system}
            onChange={(e) => setNewRow({ ...newRow, system: e.target.value as 'powertrain' | 'other' })}
          >
            <option value="powertrain">Powertrain (48 เดือน)</option>
            <option value="other">อื่นๆ (24 เดือน)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ความรุนแรงเริ่มต้น</label>
          <select
            className="border rounded px-2 py-1.5 text-sm w-full"
            value={newRow.defaultSeverity}
            onChange={(e) => setNewRow({ ...newRow, defaultSeverity: e.target.value as '' | Severity })}
          >
            <option value="">-- ไม่กำหนด --</option>
            {SEVERITY_VALUES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <button disabled={busy} onClick={create} className="bg-brand-red text-white rounded px-3 py-1.5 text-sm disabled:opacity-50">
          + เพิ่ม
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2">รหัส</th>
              <th className="px-3 py-2">หมวดหมู่</th>
              <th className="px-3 py-2">อาการเสีย</th>
              <th className="px-3 py-2">ระบบ</th>
              <th className="px-3 py-2">ความรุนแรงเริ่มต้น</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const editing = editingId === r.id;
              return (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono">
                    {editing ? (
                      <input
                        className="border rounded px-2 py-1 text-sm w-20"
                        value={draft.code ?? r.code ?? ''}
                        onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                      />
                    ) : (
                      r.code ?? '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        value={draft.groupName ?? r.group_name ?? ''}
                        onChange={(e) => setDraft({ ...draft, groupName: e.target.value })}
                      />
                    ) : (
                      r.group_name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        value={draft.label ?? r.label}
                        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                      />
                    ) : (
                      r.label
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={draft.system ?? r.system}
                        onChange={(e) => setDraft({ ...draft, system: e.target.value as 'powertrain' | 'other' })}
                      >
                        <option value="powertrain">Powertrain</option>
                        <option value="other">อื่นๆ</option>
                      </select>
                    ) : (
                      SYSTEM_LABEL[r.system]
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={draft.defaultSeverity ?? r.default_severity ?? ''}
                        onChange={(e) => setDraft({ ...draft, defaultSeverity: (e.target.value || null) as Severity | null })}
                      >
                        <option value="">-- ไม่กำหนด --</option>
                        {SEVERITY_VALUES.map((s) => (
                          <option key={s} value={s}>
                            {SEVERITY_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      r.default_severity ? SEVERITY_LABELS[r.default_severity] : '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        r.active === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {r.active === false ? 'ปิดใช้งาน' : 'ใช้งาน'}
                    </span>
                  </td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    {editing ? (
                      <>
                        <button disabled={busy} onClick={() => patch(r.id, draft)} className="text-brand-red text-xs font-medium">
                          บันทึก
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setDraft({});
                          }}
                          className="text-gray-400 text-xs"
                        >
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(r.id);
                            setDraft({});
                          }}
                          className="text-blue-600 text-xs font-medium"
                        >
                          แก้ไข
                        </button>
                        <button disabled={busy} onClick={() => patch(r.id, { active: r.active === false })} className="text-gray-500 text-xs">
                          {r.active === false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

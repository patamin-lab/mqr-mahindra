'use client';

import { useState } from 'react';
import { PmInterval } from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalClose } from '@/lib/swal';
import AdminCrudTable from '@/components/shared/admin/AdminCrudTable';
import ActionButtons from '@/components/shared/admin/ActionButtons';
import StatusBadge from '@/components/shared/status/StatusBadge';
import TextField from '@/components/shared/forms/TextField';

const COLUMNS = [
  { key: 'label', header: 'ชื่อรอบ PM' },
  { key: 'hours', header: 'ชั่วโมง' },
  { key: 'months', header: 'เดือน' },
  { key: 'status', header: 'สถานะ' },
  { key: 'actions', header: 'จัดการ' },
];

type Draft = Partial<{
  label: string;
  intervalHours: string;
  intervalMonths: string;
}>;

export default function PmIntervalsTable({ initial }: { initial: PmInterval[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [newRow, setNewRow] = useState({ label: '', intervalHours: '', intervalMonths: '' });

  async function showError(err: any) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    } else {
      await swalError(err?.message ?? 'เกิดข้อผิดพลาด');
    }
  }

  async function create() {
    setBusy(true);
    swalLoading('กำลังเพิ่ม...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; pmInterval: PmInterval }>('/api/admin/pm-intervals', {
        method: 'POST',
        body: JSON.stringify(newRow),
      });
      if (!json.ok) throw new Error(json.error);
      setRows((prev) => [...prev, json.pmInterval]);
      setNewRow({ label: '', intervalHours: '', intervalMonths: '' });
      swalClose();
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    swalLoading('กำลังบันทึก...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; pmInterval: PmInterval }>(
        `/api/admin/pm-intervals/${id}`,
        { method: 'PATCH', body: JSON.stringify(body) }
      );
      if (!json.ok) throw new Error(json.error);
      setRows((prev) => prev.map((r) => (r.id === id ? json.pmInterval : r)));
      setEditingId(null);
      setDraft({});
      swalClose();
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
        <TextField
          label="ชื่อรอบ PM"
          value={newRow.label}
          onChange={(v) => setNewRow({ ...newRow, label: v })}
          placeholder="เช่น PM1 - 250 ชม."
        />
        <TextField
          label="ชั่วโมง"
          value={newRow.intervalHours}
          onChange={(v) => setNewRow({ ...newRow, intervalHours: v })}
          placeholder="เช่น 250 (ไม่บังคับ)"
        />
        <TextField
          label="เดือน"
          value={newRow.intervalMonths}
          onChange={(v) => setNewRow({ ...newRow, intervalMonths: v })}
          placeholder="ไม่บังคับ"
        />
        <button disabled={busy} onClick={create} className="bg-brand-red text-white rounded px-3 py-1.5 text-sm disabled:opacity-50">
          + เพิ่ม
        </button>
      </div>

      <AdminCrudTable columns={COLUMNS}>
        {rows.map((r) => {
          const editing = editingId === r.id;
          return (
            <tr key={r.id} className="border-t border-gray-100">
              <td className="px-3 py-2">
                {editing ? (
                  <TextField
                    value={draft.label ?? r.label}
                    onChange={(v) => setDraft({ ...draft, label: v })}
                    inputClassName="border rounded px-2 py-1 text-sm w-full"
                  />
                ) : (
                  r.label
                )}
              </td>
              <td className="px-3 py-2">
                {editing ? (
                  <TextField
                    value={draft.intervalHours ?? (r.interval_hours != null ? String(r.interval_hours) : '')}
                    onChange={(v) => setDraft({ ...draft, intervalHours: v })}
                    inputClassName="border rounded px-2 py-1 text-sm w-24"
                  />
                ) : (
                  r.interval_hours ?? '-'
                )}
              </td>
              <td className="px-3 py-2">
                {editing ? (
                  <TextField
                    value={draft.intervalMonths ?? (r.interval_months != null ? String(r.interval_months) : '')}
                    onChange={(v) => setDraft({ ...draft, intervalMonths: v })}
                    inputClassName="border rounded px-2 py-1 text-sm w-24"
                  />
                ) : (
                  r.interval_months ?? '-'
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge active={r.active !== false} />
              </td>
              <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                <ActionButtons
                  editing={editing}
                  busy={busy}
                  active={r.active !== false}
                  onEdit={() => {
                    setEditingId(r.id);
                    setDraft({});
                  }}
                  onSave={() =>
                    patch(r.id, {
                      label: draft.label,
                      intervalHours: draft.intervalHours,
                      intervalMonths: draft.intervalMonths,
                    })
                  }
                  onCancel={() => {
                    setEditingId(null);
                    setDraft({});
                  }}
                  onToggleActive={() => patch(r.id, { active: r.active === false })}
                />
              </td>
            </tr>
          );
        })}
      </AdminCrudTable>
    </div>
  );
}

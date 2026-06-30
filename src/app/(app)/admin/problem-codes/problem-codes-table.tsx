'use client';

import { useState } from 'react';
import { ProblemCode, Severity, SEVERITY_VALUES, SEVERITY_LABELS } from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalClose } from '@/lib/swal';
import AdminCrudTable from '@/components/shared/admin/AdminCrudTable';
import ActionButtons from '@/components/shared/admin/ActionButtons';
import StatusBadge from '@/components/shared/status/StatusBadge';
import TextField from '@/components/shared/forms/TextField';
import SelectField from '@/components/shared/forms/SelectField';

const SYSTEM_LABEL: Record<'powertrain' | 'other', string> = {
  powertrain: 'Powertrain (48 เดือน)',
  other: 'อื่นๆ (24 เดือน)',
};

const SYSTEM_OPTIONS = [
  { value: 'powertrain', label: 'Powertrain (48 เดือน)' },
  { value: 'other', label: 'อื่นๆ (24 เดือน)' },
];

const SYSTEM_OPTIONS_SHORT = [
  { value: 'powertrain', label: 'Powertrain' },
  { value: 'other', label: 'อื่นๆ' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: '-- ไม่กำหนด --' },
  ...SEVERITY_VALUES.map((s) => ({ value: s, label: SEVERITY_LABELS[s] })),
];

const COLUMNS = [
  { key: 'code', header: 'รหัส' },
  { key: 'group', header: 'หมวดหมู่' },
  { key: 'label', header: 'อาการเสีย' },
  { key: 'system', header: 'ระบบ' },
  { key: 'severity', header: 'ความรุนแรงเริ่มต้น' },
  { key: 'status', header: 'สถานะ' },
  { key: 'actions', header: 'จัดการ' },
];

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
    swalLoading('กำลังเพิ่ม...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; problemCode: ProblemCode }>('/api/admin/problem-codes', {
        method: 'POST',
        body: JSON.stringify({ ...newRow, defaultSeverity: newRow.defaultSeverity || null }),
      });
      if (!json.ok) throw new Error(json.error);
      setRows((prev) => [...prev, json.problemCode]);
      setNewRow({ code: '', label: '', groupName: '', system: 'other', defaultSeverity: '' });
      swalClose();
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Draft & { active?: boolean }) {
    setBusy(true);
    swalLoading('กำลังบันทึก...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; problemCode: ProblemCode }>(`/api/admin/problem-codes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!json.ok) throw new Error(json.error);
      setRows((prev) => prev.map((r) => (r.id === id ? json.problemCode : r)));
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
        <TextField label="รหัส" value={newRow.code} onChange={(v) => setNewRow({ ...newRow, code: v })} />
        <TextField
          label="หมวดหมู่ (Category)"
          value={newRow.groupName}
          onChange={(v) => setNewRow({ ...newRow, groupName: v })}
          placeholder="เช่น เครื่องยนต์"
        />
        <TextField
          label="อาการเสีย (Sub-category)"
          value={newRow.label}
          onChange={(v) => setNewRow({ ...newRow, label: v })}
        />
        <SelectField
          label="ระบบ"
          value={newRow.system}
          onChange={(v) => setNewRow({ ...newRow, system: v as 'powertrain' | 'other' })}
          options={SYSTEM_OPTIONS}
        />
        <SelectField
          label="ความรุนแรงเริ่มต้น"
          value={newRow.defaultSeverity}
          onChange={(v) => setNewRow({ ...newRow, defaultSeverity: v as '' | Severity })}
          options={SEVERITY_OPTIONS}
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
              <td className="px-3 py-2 font-mono">
                {editing ? (
                  <TextField
                    value={draft.code ?? r.code ?? ''}
                    onChange={(v) => setDraft({ ...draft, code: v })}
                    inputClassName="border rounded px-2 py-1 text-sm w-20"
                  />
                ) : (
                  r.code ?? '-'
                )}
              </td>
              <td className="px-3 py-2">
                {editing ? (
                  <TextField
                    value={draft.groupName ?? r.group_name ?? ''}
                    onChange={(v) => setDraft({ ...draft, groupName: v })}
                    inputClassName="border rounded px-2 py-1 text-sm w-full"
                  />
                ) : (
                  r.group_name
                )}
              </td>
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
                  <SelectField
                    value={draft.system ?? r.system}
                    onChange={(v) => setDraft({ ...draft, system: v as 'powertrain' | 'other' })}
                    options={SYSTEM_OPTIONS_SHORT}
                    selectClassName="border rounded px-2 py-1 text-sm"
                  />
                ) : (
                  SYSTEM_LABEL[r.system]
                )}
              </td>
              <td className="px-3 py-2">
                {editing ? (
                  <SelectField
                    value={draft.defaultSeverity ?? r.default_severity ?? ''}
                    onChange={(v) => setDraft({ ...draft, defaultSeverity: (v || null) as Severity | null })}
                    options={SEVERITY_OPTIONS}
                    selectClassName="border rounded px-2 py-1 text-sm"
                  />
                ) : r.default_severity ? (
                  SEVERITY_LABELS[r.default_severity]
                ) : (
                  '-'
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
                  onSave={() => patch(r.id, draft)}
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

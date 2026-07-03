'use client';

import { useState } from 'react';
import { ProductFamily } from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalClose } from '@/lib/swal';
import AdminCrudTable from '@/components/shared/admin/AdminCrudTable';
import ActionButtons from '@/components/shared/admin/ActionButtons';
import StatusBadge from '@/components/shared/status/StatusBadge';
import TextField from '@/components/shared/forms/TextField';

const COLUMNS = [
  { key: 'code', header: 'รหัส' },
  { key: 'name', header: 'ชื่อกลุ่มผลิตภัณฑ์' },
  { key: 'description', header: 'คำอธิบาย' },
  { key: 'status', header: 'สถานะ' },
  { key: 'actions', header: 'จัดการ' },
];

type Draft = Partial<{ code: string; name: string; description: string }>;

export default function ProductFamiliesTable({ initial }: { initial: ProductFamily[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [newRow, setNewRow] = useState({ code: '', name: '', description: '' });

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
      const json = await fetchJson<{ ok: boolean; error?: string; productFamily: ProductFamily }>(
        '/api/admin/product-families',
        { method: 'POST', body: JSON.stringify(newRow) }
      );
      if (!json.ok) throw new Error(json.error);
      setRows((prev) => [...prev, json.productFamily]);
      setNewRow({ code: '', name: '', description: '' });
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
      const json = await fetchJson<{ ok: boolean; error?: string; productFamily: ProductFamily }>(
        `/api/admin/product-families/${id}`,
        { method: 'PATCH', body: JSON.stringify(body) }
      );
      if (!json.ok) throw new Error(json.error);
      setRows((prev) => prev.map((r) => (r.id === id ? json.productFamily : r)));
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
        <TextField label="รหัส" value={newRow.code} onChange={(v) => setNewRow({ ...newRow, code: v })} placeholder="เช่น OJA_COMPACT" />
        <TextField label="ชื่อกลุ่มผลิตภัณฑ์" value={newRow.name} onChange={(v) => setNewRow({ ...newRow, name: v })} placeholder="เช่น OJA Compact" />
        <TextField
          label="คำอธิบาย"
          value={newRow.description}
          onChange={(v) => setNewRow({ ...newRow, description: v })}
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
                  <TextField value={draft.code ?? r.code} onChange={(v) => setDraft({ ...draft, code: v })} inputClassName="border rounded px-2 py-1 text-sm w-full" />
                ) : (
                  r.code
                )}
              </td>
              <td className="px-3 py-2">
                {editing ? (
                  <TextField value={draft.name ?? r.name} onChange={(v) => setDraft({ ...draft, name: v })} inputClassName="border rounded px-2 py-1 text-sm w-full" />
                ) : (
                  r.name
                )}
              </td>
              <td className="px-3 py-2">
                {editing ? (
                  <TextField
                    value={draft.description ?? r.description ?? ''}
                    onChange={(v) => setDraft({ ...draft, description: v })}
                    inputClassName="border rounded px-2 py-1 text-sm w-full"
                  />
                ) : (
                  r.description ?? '-'
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
                  onSave={() => patch(r.id, { code: draft.code, name: draft.name, description: draft.description })}
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

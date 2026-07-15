'use client';

import { useState } from 'react';
import { Branch, Dealer } from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalClose } from '@/lib/swal';
import ActiveBadge from '@/components/shared/admin/ActiveBadge';

export default function BranchesTable({
  initialBranches,
  dealers,
  lockedDealerId,
}: {
  initialBranches: Branch[];
  dealers: Dealer[];
  lockedDealerId: string | null;
}) {
  const [branches, setBranches] = useState(initialBranches);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Branch>>({});
  const [newBranch, setNewBranch] = useState({ code: '', name: '', dealer_id: lockedDealerId ?? '' });

  async function showError(err: any) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    } else {
      await swalError(err?.message ?? 'เกิดข้อผิดพลาด');
    }
  }

  async function createBranch() {
    setBusy(true);
    swalLoading('กำลังเพิ่มสาขา...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; branch: Branch }>('/api/admin/branches', {
        method: 'POST',
        body: JSON.stringify(newBranch),
      });
      if (!json.ok) throw new Error(json.error);
      setBranches((prev) => [...prev, json.branch].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBranch({ code: '', name: '', dealer_id: lockedDealerId ?? '' });
      swalClose();
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    setBusy(true);
    swalLoading('กำลังบันทึก...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; branch: Branch }>(`/api/admin/branches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(editDraft),
      });
      if (!json.ok) throw new Error(json.error);
      setBranches((prev) => prev.map((b) => (b.id === id ? json.branch : b)));
      setEditingId(null);
      swalClose();
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(b: Branch) {
    setBusy(true);
    swalLoading();
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; branch: Branch }>(`/api/admin/branches/${b.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !b.active }),
      });
      if (!json.ok) throw new Error(json.error);
      setBranches((prev) => prev.map((x) => (x.id === b.id ? json.branch : x)));
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">รหัสสาขา</label>
          <input className="border rounded px-2 py-1.5 text-sm w-full" value={newBranch.code} onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ชื่อสาขา</label>
          <input className="border rounded px-2 py-1.5 text-sm w-full" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} />
        </div>
        {!lockedDealerId && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">ดีลเลอร์</label>
            <select className="border rounded px-2 py-1.5 text-sm w-full" value={newBranch.dealer_id} onChange={(e) => setNewBranch({ ...newBranch, dealer_id: e.target.value })}>
              <option value="">เลือกดีลเลอร์</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.short_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button disabled={busy} onClick={createBranch} className="bg-brand-red text-white rounded px-3 py-1.5 text-sm disabled:opacity-50">
          + เพิ่มสาขา
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2">รหัส</th>
              <th className="px-3 py-2">ชื่อสาขา</th>
              <th className="px-3 py-2">ดีลเลอร์</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => {
              const isEditing = editingId === b.id;
              return (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 text-sm w-full" value={editDraft.code ?? b.code ?? ''} onChange={(e) => setEditDraft({ ...editDraft, code: e.target.value })} />
                    ) : (
                      b.code ?? '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 text-sm w-full" value={editDraft.name ?? b.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                    ) : (
                      b.name
                    )}
                  </td>
                  <td className="px-3 py-2">{b.dealer_id}</td>
                  <td className="px-3 py-2">
                    <ActiveBadge active={b.active} />
                  </td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button disabled={busy} onClick={() => saveEdit(b.id)} className="text-brand-red text-xs font-medium">
                          บันทึก
                        </button>
                        <button onClick={() => { setEditingId(null); setEditDraft({}); }} className="text-gray-400 text-xs">
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(b.id); setEditDraft({}); }} className="text-blue-600 text-xs font-medium">
                          แก้ไข
                        </button>
                        <button disabled={busy} onClick={() => toggleActive(b)} className="text-gray-500 text-xs">
                          {b.active === false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
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

'use client';

import { useState } from 'react';
import { Technician, Dealer } from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalClose } from '@/lib/swal';

export default function TechniciansTable({
  initialTechnicians,
  dealers,
  lockedDealerId,
}: {
  initialTechnicians: Technician[];
  dealers: Dealer[];
  lockedDealerId: string | null;
}) {
  const [technicians, setTechnicians] = useState(initialTechnicians);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Technician>>({});
  const [newTech, setNewTech] = useState({ code: '', name: '', mobile: '', branch: '', dealer_id: lockedDealerId ?? '' });

  async function showError(err: any) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    } else {
      await swalError(err?.message ?? 'เกิดข้อผิดพลาด');
    }
  }

  async function createTech() {
    setBusy(true);
    swalLoading('กำลังเพิ่มช่าง...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; technician: Technician }>('/api/admin/technicians', {
        method: 'POST',
        body: JSON.stringify(newTech),
      });
      if (!json.ok) throw new Error(json.error);
      setTechnicians((prev) => [...prev, json.technician].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTech({ code: '', name: '', mobile: '', branch: '', dealer_id: lockedDealerId ?? '' });
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
      const json = await fetchJson<{ ok: boolean; error?: string; technician: Technician }>(`/api/admin/technicians/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(editDraft),
      });
      if (!json.ok) throw new Error(json.error);
      setTechnicians((prev) => prev.map((t) => (t.id === id ? json.technician : t)));
      setEditingId(null);
      swalClose();
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: Technician) {
    setBusy(true);
    swalLoading();
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; technician: Technician }>(`/api/admin/technicians/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !t.active }),
      });
      if (!json.ok) throw new Error(json.error);
      setTechnicians((prev) => prev.map((x) => (x.id === t.id ? json.technician : x)));
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">รหัสช่าง</label>
          <input className="border rounded px-2 py-1.5 text-sm w-full" value={newTech.code} onChange={(e) => setNewTech({ ...newTech, code: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ชื่อช่าง</label>
          <input className="border rounded px-2 py-1.5 text-sm w-full" value={newTech.name} onChange={(e) => setNewTech({ ...newTech, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">เบอร์โทร</label>
          <input className="border rounded px-2 py-1.5 text-sm w-full" value={newTech.mobile} onChange={(e) => setNewTech({ ...newTech, mobile: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">สาขา</label>
          <input className="border rounded px-2 py-1.5 text-sm w-full" value={newTech.branch} onChange={(e) => setNewTech({ ...newTech, branch: e.target.value })} />
        </div>
        {!lockedDealerId && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">ดีลเลอร์</label>
            <select className="border rounded px-2 py-1.5 text-sm w-full" value={newTech.dealer_id} onChange={(e) => setNewTech({ ...newTech, dealer_id: e.target.value })}>
              <option value="">เลือกดีลเลอร์</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.short_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button disabled={busy} onClick={createTech} className="bg-brand-red text-white rounded px-3 py-1.5 text-sm disabled:opacity-50">
          + เพิ่มช่าง
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2">รหัส</th>
              <th className="px-3 py-2">ชื่อช่าง</th>
              <th className="px-3 py-2">เบอร์โทร</th>
              <th className="px-3 py-2">สาขา</th>
              <th className="px-3 py-2">ดีลเลอร์</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {technicians.map((t) => {
              const isEditing = editingId === t.id;
              return (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 text-sm w-full" value={editDraft.code ?? t.code ?? ''} onChange={(e) => setEditDraft({ ...editDraft, code: e.target.value })} />
                    ) : (
                      t.code ?? '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 text-sm w-full" value={editDraft.name ?? t.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                    ) : (
                      t.name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 text-sm w-full" value={editDraft.mobile ?? t.mobile ?? ''} onChange={(e) => setEditDraft({ ...editDraft, mobile: e.target.value })} />
                    ) : (
                      t.mobile ?? '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 text-sm w-full" value={editDraft.branch ?? t.branch ?? ''} onChange={(e) => setEditDraft({ ...editDraft, branch: e.target.value })} />
                    ) : (
                      t.branch ?? '-'
                    )}
                  </td>
                  <td className="px-3 py-2">{t.dealer_id}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${t.active === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                      {t.active === false ? 'ปิดใช้งาน' : 'ใช้งาน'}
                    </span>
                  </td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button disabled={busy} onClick={() => saveEdit(t.id)} className="text-brand-red text-xs font-medium">
                          บันทึก
                        </button>
                        <button onClick={() => { setEditingId(null); setEditDraft({}); }} className="text-gray-400 text-xs">
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(t.id); setEditDraft({}); }} className="text-blue-600 text-xs font-medium">
                          แก้ไข
                        </button>
                        <button disabled={busy} onClick={() => toggleActive(t)} className="text-gray-500 text-xs">
                          {t.active === false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
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

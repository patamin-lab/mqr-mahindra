'use client';

import { useState } from 'react';
import { Dealer } from '@/lib/types';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalError, swalLoading, swalClose } from '@/lib/swal';

export default function DealersTable({ initialDealers }: { initialDealers: Dealer[] }) {
  const [dealers, setDealers] = useState(initialDealers);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Dealer>>({});
  const [newDealer, setNewDealer] = useState({ id: '', short_name: '', full_name: '', address: '' });

  async function showError(err: any) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    } else {
      await swalError(err?.message ?? 'เกิดข้อผิดพลาด');
    }
  }

  async function createDealer() {
    setBusy(true);
    swalLoading('กำลังเพิ่มดีลเลอร์...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; dealer: Dealer }>('/api/admin/dealers', {
        method: 'POST',
        body: JSON.stringify(newDealer),
      });
      if (!json.ok) throw new Error(json.error);
      setDealers((prev) => [...prev, json.dealer].sort((a, b) => a.short_name.localeCompare(b.short_name)));
      setNewDealer({ id: '', short_name: '', full_name: '', address: '' });
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
      const json = await fetchJson<{ ok: boolean; error?: string; dealer: Dealer }>(`/api/admin/dealers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(editDraft),
      });
      if (!json.ok) throw new Error(json.error);
      setDealers((prev) => prev.map((d) => (d.id === id ? json.dealer : d)));
      setEditingId(null);
      swalClose();
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(d: Dealer) {
    setBusy(true);
    swalLoading();
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; dealer: Dealer }>(`/api/admin/dealers/${d.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !d.active }),
      });
      if (!json.ok) throw new Error(json.error);
      setDealers((prev) => prev.map((x) => (x.id === d.id ? json.dealer : x)));
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
          <label className="block text-xs text-gray-500 mb-1">รหัสดีลเลอร์</label>
          <input
            className="border rounded px-2 py-1.5 text-sm w-full"
            value={newDealer.id}
            onChange={(e) => setNewDealer({ ...newDealer, id: e.target.value.toUpperCase() })}
            placeholder="เช่น KTV"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ชื่อย่อ</label>
          <input
            className="border rounded px-2 py-1.5 text-sm w-full"
            value={newDealer.short_name}
            onChange={(e) => setNewDealer({ ...newDealer, short_name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ชื่อเต็ม</label>
          <input
            className="border rounded px-2 py-1.5 text-sm w-full"
            value={newDealer.full_name}
            onChange={(e) => setNewDealer({ ...newDealer, full_name: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ที่อยู่</label>
          <input
            className="border rounded px-2 py-1.5 text-sm w-full"
            value={newDealer.address}
            onChange={(e) => setNewDealer({ ...newDealer, address: e.target.value })}
          />
        </div>
        <button
          disabled={busy}
          onClick={createDealer}
          className="bg-brand-red text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
        >
          + เพิ่มดีลเลอร์
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2">รหัส</th>
              <th className="px-3 py-2">ชื่อย่อ</th>
              <th className="px-3 py-2">ชื่อเต็ม</th>
              <th className="px-3 py-2">ที่อยู่</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((d) => {
              const isEditing = editingId === d.id;
              return (
                <tr key={d.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono">{d.id}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        value={editDraft.short_name ?? d.short_name}
                        onChange={(e) => setEditDraft({ ...editDraft, short_name: e.target.value })}
                      />
                    ) : (
                      d.short_name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        value={editDraft.full_name ?? d.full_name}
                        onChange={(e) => setEditDraft({ ...editDraft, full_name: e.target.value })}
                      />
                    ) : (
                      d.full_name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1 text-sm w-full"
                        value={editDraft.address ?? d.address ?? ''}
                        onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })}
                      />
                    ) : (
                      d.address ?? '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        d.active === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {d.active === false ? 'ปิดใช้งาน' : 'ใช้งาน'}
                    </span>
                  </td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button disabled={busy} onClick={() => saveEdit(d.id)} className="text-brand-red text-xs font-medium">
                          บันทึก
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft({});
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
                            setEditingId(d.id);
                            setEditDraft({});
                          }}
                          className="text-blue-600 text-xs font-medium"
                        >
                          แก้ไข
                        </button>
                        <button disabled={busy} onClick={() => toggleActive(d)} className="text-gray-500 text-xs">
                          {d.active === false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
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

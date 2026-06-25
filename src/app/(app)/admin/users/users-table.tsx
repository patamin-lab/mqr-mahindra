'use client';

import { useState } from 'react';
import { AdminUser, Dealer, Role } from '@/lib/types';
import { assignableRoles, canDeleteUsers, canManageRoleTarget, roleLabelTh } from '@/lib/scope';
import { swalConfirm, swalError, swalSuccess, swalPrompt, swalLoading, swalClose } from '@/lib/swal';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';

export default function UsersTable({
  initialUsers,
  dealers,
  lockedDealerId,
  actorRole,
  currentUsername,
}: {
  initialUsers: AdminUser[];
  dealers: Dealer[];
  lockedDealerId: string | null;
  actorRole: Role;
  currentUsername: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<AdminUser>>({});

  const myAssignableRoles = assignableRoles(actorRole);
  const iCanDelete = canDeleteUsers(actorRole);

  const [newUser, setNewUser] = useState({
    username: '',
    full_name: '',
    password: '',
    email: '',
    mobile: '',
    role: myAssignableRoles[myAssignableRoles.length - 1] ?? 'DealerUser',
    dealer_id: lockedDealerId ?? '',
    branch: '',
  });

  async function showError(err: any) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalError('เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    } else {
      await swalError(err?.message ?? 'เกิดข้อผิดพลาด');
    }
  }

  async function createUser() {
    setBusy(true);
    swalLoading('กำลังเพิ่มผู้ใช้...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; user: AdminUser }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });
      if (!json.ok) throw new Error(json.error);
      setUsers((prev) => [...prev, json.user].sort((a, b) => a.username.localeCompare(b.username)));
      setNewUser({ ...newUser, username: '', full_name: '', password: '', email: '', mobile: '', branch: '' });
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
      const json = await fetchJson<{ ok: boolean; error?: string; user: AdminUser }>(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(editDraft),
      });
      if (!json.ok) throw new Error(json.error);
      setUsers((prev) => prev.map((u) => (u.id === id ? json.user : u)));
      setEditingId(null);
      swalClose();
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: AdminUser) {
    setBusy(true);
    swalLoading();
    try {
      const json = await fetchJson<{ ok: boolean; error?: string; user: AdminUser }>(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !u.active }),
      });
      if (!json.ok) throw new Error(json.error);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? json.user : x)));
      swalClose();
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(u: AdminUser) {
    const pw = await swalPrompt(`รหัสผ่านใหม่สำหรับ ${u.username} (อย่างน้อย 6 ตัวอักษร)`, {
      title: 'รีเซ็ตรหัสผ่าน',
      inputType: 'password',
      placeholder: 'รหัสผ่านใหม่',
    });
    if (!pw) return;
    setBusy(true);
    swalLoading('กำลังรีเซ็ตรหัสผ่าน...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string }>(`/api/admin/users/${u.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: pw }),
      });
      if (!json.ok) throw new Error(json.error);
      swalClose();
      await swalSuccess('รีเซ็ตรหัสผ่านสำเร็จ');
    } catch (err: any) {
      swalClose();
      await showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(u: AdminUser) {
    const confirmed = await swalConfirm(`ยืนยันการลบผู้ใช้ ${u.username}? การลบนี้ไม่สามารถย้อนกลับได้`, {
      title: 'ลบผู้ใช้',
      confirmText: 'ลบผู้ใช้',
    });
    if (!confirmed) return;
    setBusy(true);
    swalLoading('กำลังลบผู้ใช้...');
    try {
      const json = await fetchJson<{ ok: boolean; error?: string }>(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      if (!json.ok) throw new Error(json.error);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
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
      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <input className="border rounded px-2 py-1.5 text-sm" placeholder="ชื่อผู้ใช้ (username)" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value.trim() })} />
        <input className="border rounded px-2 py-1.5 text-sm" placeholder="ชื่อ-สกุล" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} />
        <input className="border rounded px-2 py-1.5 text-sm" placeholder="รหัสผ่านเริ่มต้น" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
        <select className="border rounded px-2 py-1.5 text-sm" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}>
          {myAssignableRoles.map((r) => (
            <option key={r} value={r}>
              {roleLabelTh[r]}
            </option>
          ))}
        </select>
        <input className="border rounded px-2 py-1.5 text-sm" placeholder="อีเมล" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
        <input className="border rounded px-2 py-1.5 text-sm" placeholder="เบอร์โทร" value={newUser.mobile} onChange={(e) => setNewUser({ ...newUser, mobile: e.target.value })} />
        <input className="border rounded px-2 py-1.5 text-sm" placeholder="สาขา (ถ้ามี)" value={newUser.branch} onChange={(e) => setNewUser({ ...newUser, branch: e.target.value })} />
        {!lockedDealerId ? (
          <select className="border rounded px-2 py-1.5 text-sm" value={newUser.dealer_id} onChange={(e) => setNewUser({ ...newUser, dealer_id: e.target.value })}>
            <option value="">ไม่ระบุดีลเลอร์ (ส่วนกลาง)</option>
            {dealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.short_name}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-xs text-gray-400 flex items-center px-2">ดีลเลอร์: {lockedDealerId}</div>
        )}
        <button disabled={busy} onClick={createUser} className="btn-primary col-span-2 md:col-span-1">
          + เพิ่มผู้ใช้
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">ชื่อ-สกุล</th>
              <th className="px-3 py-2">บทบาท</th>
              <th className="px-3 py-2">ดีลเลอร์</th>
              <th className="px-3 py-2">สาขา</th>
              <th className="px-3 py-2">ติดต่อ</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isEditing = editingId === u.id;
              const manageable = canManageRoleTarget(actorRole, u.role);
              return (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono">{u.username}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 text-sm w-full" value={editDraft.full_name ?? u.full_name} onChange={(e) => setEditDraft({ ...editDraft, full_name: e.target.value })} />
                    ) : (
                      u.full_name
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing && manageable ? (
                      <select className="border rounded px-2 py-1 text-sm" value={editDraft.role ?? u.role} onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value as Role })}>
                        {myAssignableRoles.map((r) => (
                          <option key={r} value={r}>
                            {roleLabelTh[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      roleLabelTh[u.role]
                    )}
                  </td>
                  <td className="px-3 py-2">{u.dealer_id ?? '-'}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input className="border rounded px-2 py-1 text-sm w-full" value={editDraft.branch ?? u.branch ?? ''} onChange={(e) => setEditDraft({ ...editDraft, branch: e.target.value })} />
                    ) : (
                      u.branch ?? '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input className="border rounded px-2 py-1 text-sm w-full" placeholder="อีเมล" value={editDraft.email ?? u.email ?? ''} onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })} />
                        <input className="border rounded px-2 py-1 text-sm w-full" placeholder="เบอร์โทร" value={editDraft.mobile ?? u.mobile ?? ''} onChange={(e) => setEditDraft({ ...editDraft, mobile: e.target.value })} />
                      </div>
                    ) : (
                      <>
                        <div>{u.email ?? '-'}</div>
                        <div>{u.mobile ?? '-'}</div>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${u.active === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                      {u.active === false ? 'ปิดใช้งาน' : 'ใช้งาน'}
                    </span>
                  </td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    {!manageable ? (
                      <span className="text-xs text-gray-300">-</span>
                    ) : isEditing ? (
                      <>
                        <button disabled={busy} onClick={() => saveEdit(u.id)} className="text-brand-red text-xs font-medium">
                          บันทึก
                        </button>
                        <button onClick={() => { setEditingId(null); setEditDraft({}); }} className="text-gray-400 text-xs">
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(u.id); setEditDraft({}); }} className="text-blue-600 text-xs font-medium">
                          แก้ไข
                        </button>
                        <button disabled={busy} onClick={() => toggleActive(u)} className="text-gray-500 text-xs">
                          {u.active === false ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </button>
                        <button disabled={busy} onClick={() => resetPassword(u)} className="text-amber-600 text-xs">
                          รีเซ็ตรหัสผ่าน
                        </button>
                        {iCanDelete && u.username !== currentUsername && (
                          <button disabled={busy} onClick={() => removeUser(u)} className="text-red-600 text-xs">
                            ลบ
                          </button>
                        )}
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

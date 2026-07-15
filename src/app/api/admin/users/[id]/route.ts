import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { getUserById, updateUserAdmin, deleteUserAdmin } from '@/lib/db';
import { canManageUsers, canDeleteUsers, canManageRoleTarget, assignableRoles, seesAllDealers } from '@/lib/scope';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { Role } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    const target = await getUserById(params.id);
    if (!target) return NextResponse.json({ ok: false, error: 'ไม่พบผู้ใช้นี้' }, { status: 404 });
    if (!canManageRoleTarget(session.role, target.role)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์แก้ไขผู้ใช้นี้' }, { status: 403 });
    }
    if (!canAccessDealerBranch(session, target.dealer_id ?? '', null)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์แก้ไขผู้ใช้นี้' }, { status: 403 });
    }

    const body = await req.json();
    const patch: Parameters<typeof updateUserAdmin>[1] = {};
    if (body.full_name !== undefined) patch.fullName = String(body.full_name).trim();
    if (body.email !== undefined) patch.email = body.email;
    if (body.mobile !== undefined) patch.mobile = body.mobile;
    if (body.branch !== undefined) patch.branch = body.branch;
    if (body.active !== undefined) patch.active = Boolean(body.active);
    if (body.role !== undefined) {
      const newRole = String(body.role) as Role;
      if (!assignableRoles(session.role).includes(newRole)) {
        return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์กำหนดบทบาทนี้' }, { status: 403 });
      }
      patch.role = newRole;
    }
    if (seesAllDealers(session.role) && body.dealer_id !== undefined) patch.dealerId = body.dealer_id;

    const user = await updateUserAdmin(params.id, patch, session);
    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    console.error('update user error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!canDeleteUsers(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์ลบผู้ใช้ (เฉพาะ SuperAdmin)' }, { status: 403 });
  }
  try {
    const target = await getUserById(params.id);
    if (!target) return NextResponse.json({ ok: false, error: 'ไม่พบผู้ใช้นี้' }, { status: 404 });
    if (target.username === session.username) {
      return NextResponse.json({ ok: false, error: 'ไม่สามารถลบบัญชีของตัวเองได้' }, { status: 400 });
    }
    await deleteUserAdmin(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('delete user error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

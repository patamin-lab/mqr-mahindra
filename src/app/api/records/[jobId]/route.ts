import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRecordByJobId, updateRecord, softDeleteRecord } from '@/lib/db';
import { canUpdateStatus, canDelete } from '@/lib/scope';

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const record = await getRecordByJobId(decodeURIComponent(params.jobId), session);
  if (!record) {
    return NextResponse.json({ ok: false, error: 'ไม่พบรายงานนี้' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, record });
}

export async function PATCH(req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!canUpdateStatus(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์อัปเดตสถานะรายงาน' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const record = await updateRecord(
      decodeURIComponent(params.jobId),
      {
        status: body.status,
        cause: body.cause,
        damagedParts: body.damagedParts,
        afterPhotoLink: body.afterPhotoLink,
      },
      session
    );
    return NextResponse.json({ ok: true, record });
  } catch (err: any) {
    console.error('update record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

/** Soft delete only (sets record_status = 'Deleted' + audit fields) — never a hard delete. */
export async function DELETE(req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!canDelete(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์ลบรายงานนี้' }, { status: 403 });
  }
  try {
    await softDeleteRecord(decodeURIComponent(params.jobId), session);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('delete record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

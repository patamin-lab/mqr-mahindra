import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRecordByJobId, updateRecord, softDeleteRecord, getDealer } from '@/lib/db';
import { canUpdateStatus, canDelete } from '@/lib/scope';
import { PhotoLink, Severity } from '@/lib/types';
import { sendRecordNotification } from '@/lib/email';

const SEVERITY_VALUES: Severity[] = ['Critical', 'Major', 'Minor'];
// Per spec section 8: the second notification email fires when a job is
// closed out ("ปิดงาน" / ซ่อมสำเร็จ). Only fire once, on the transition into
// this set — not on every subsequent edit while already closed.
const CLOSING_STATUSES = new Set(['Repaired', 'Closed']);

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
    if (body.severity !== undefined && body.severity !== null && !SEVERITY_VALUES.includes(body.severity)) {
      return NextResponse.json({ ok: false, error: 'ความรุนแรงไม่ถูกต้อง' }, { status: 400 });
    }
    const addPhotoLinks: PhotoLink[] | undefined = Array.isArray(body.addPhotoLinks)
      ? body.addPhotoLinks
      : undefined;

    const jobId = decodeURIComponent(params.jobId);
    const before = await getRecordByJobId(jobId, session);
    const wasAlreadyClosed = before ? CLOSING_STATUSES.has(before.status) : false;

    const record = await updateRecord(
      jobId,
      {
        status: body.status,
        severity: body.severity || undefined,
        cause: body.cause,
        damagedParts: body.damagedParts,
        peripheralEquipment: body.peripheralEquipment,
        technicianAction: body.technicianAction,
        correctiveAction: body.correctiveAction,
        preventiveAction: body.preventiveAction,
        addPhotoLinks,
      },
      session
    );

    const justClosed = !wasAlreadyClosed && CLOSING_STATUSES.has(record.status);
    if (justClosed) {
      try {
        const dealer = await getDealer(record.dealer_id);
        await sendRecordNotification(record, dealer?.full_name, new URL(req.url).origin, 'closed');
      } catch (err) {
        console.error('notification email error (closed)', err);
      }
    }

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

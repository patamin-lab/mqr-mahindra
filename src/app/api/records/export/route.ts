import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listRecords } from '@/lib/db';
import { canExport } from '@/lib/scope';
import { buildRecordsWorkbook } from '@/lib/exportExcel';
import { renderRecordsListPdf } from '@/lib/exportPdf';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!canExport(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์ส่งออกข้อมูล' }, { status: 403 });
  }

  try {
    const { searchParams, origin } = new URL(req.url);
    const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx';
    const records = await listRecords(session, {
      status: searchParams.get('status') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      dealerId: searchParams.get('dealerId') ?? undefined,
      branchId: searchParams.get('branchId') ?? undefined,
    });

    const filenameBase = `qir-records-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'pdf') {
      const buf = await renderRecordsListPdf(records, 'รายงานปัญหาคุณภาพทั้งหมด', origin);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
        },
      });
    }

    const buf = await buildRecordsWorkbook(records);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('records export error', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'ส่งออกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}

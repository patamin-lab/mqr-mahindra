import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createRecord, getVehicleBySerial } from '@/lib/db';
import { calcWarranty } from '@/lib/warranty';
import { seesAllDealers } from '@/lib/scope';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!session.dealerId) {
    return NextResponse.json({ ok: false, error: 'ผู้ใช้นี้ไม่ได้ผูกกับดีลเลอร์' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const serial = String(body.serial ?? '').trim();
    const foundDate = String(body.foundDate ?? '').trim();
    const problemCode = String(body.problemCode ?? '').trim();
    const problemSystem = body.problemSystem === 'powertrain' ? 'powertrain' : 'other';

    if (!serial || !foundDate || !problemCode) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    // Zero-leakage: if the vehicle exists but belongs to another dealer, treat it as not found.
    const vehicle = await getVehicleBySerial(serial, seesAllDealers(session.role) ? null : session.dealerId);
    if (vehicle && session.dealerId && vehicle.dealer_id && vehicle.dealer_id !== session.dealerId) {
      return NextResponse.json({ ok: false, error: 'หมายเลขรถนี้ไม่ได้อยู่ในดีลเลอร์ของคุณ' }, { status: 403 });
    }

    const warranty = calcWarranty(vehicle?.delivery_date ?? null, foundDate, problemSystem);

    const record = await createRecord(
      {
        serial,
        model: String(body.model ?? vehicle?.model ?? ''),
        hours: body.hours === '' || body.hours === undefined || body.hours === null ? null : Number(body.hours),
        foundDate,
        problemCode,
        problemSystem,
        warrantyStatus: warranty.status,
        customerName: String(body.customerName ?? ''),
        customerPhone: String(body.customerPhone ?? ''),
        reporterName: String(body.reporterName ?? ''),
        reporterPhone: String(body.reporterPhone ?? ''),
        attachment: String(body.attachment ?? ''),
        stockNote: vehicle ? null : String(body.stockNote ?? ''),
        lat: body.lat === undefined || body.lat === null || body.lat === '' ? null : Number(body.lat),
        lng: body.lng === undefined || body.lng === null || body.lng === '' ? null : Number(body.lng),
        photoLinks: Array.isArray(body.photoLinks) ? body.photoLinks : [],
        videoLink: body.videoLink ? String(body.videoLink) : null,
      },
      session
    );

    return NextResponse.json({ ok: true, record, warranty });
  } catch (err: any) {
    console.error('create record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

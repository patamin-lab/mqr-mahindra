import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createRecord, getVehicleBySerial } from '@/lib/db';
import { calcWarranty } from '@/lib/warranty';
import { seesAllDealers } from '@/lib/scope';
import { PhotoLink, Severity } from '@/lib/types';

const SEVERITY_VALUES: Severity[] = ['Critical', 'Major', 'Minor'];

const THAI_MOBILE_RE = /^0[0-9]{9}$/;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!seesAllDealers(session.role) && !session.dealerId) {
    return NextResponse.json({ ok: false, error: 'ผู้ใช้นี้ไม่ได้ผูกกับดีลเลอร์' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const serial = String(body.serial ?? '').trim();
    const foundDate = String(body.foundDate ?? '').trim();
    const repairDate = String(body.repairDate ?? '').trim();
    const problemCode = String(body.problemCode ?? '').trim();
    const problemSystem = body.problemSystem === 'powertrain' ? 'powertrain' : 'other';
    const customerName = String(body.customerName ?? '').trim();
    const customerPhone = String(body.customerPhone ?? '').replace(/[^0-9]/g, '');

    if (!serial || !foundDate || !problemCode) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกหมายเลขรถ วันที่พบปัญหา และอาการที่พบ ให้ครบถ้วน' }, { status: 400 });
    }
    if (!repairDate) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกวันที่นำรถเข้าซ่อม' }, { status: 400 });
    }
    if (new Date(repairDate) < new Date(foundDate)) {
      return NextResponse.json({ ok: false, error: 'วันที่นำรถเข้าซ่อม ต้องไม่ก่อนวันที่พบปัญหา' }, { status: 400 });
    }
    if (!customerName) {
      return NextResponse.json({ ok: false, error: 'กรุณากรอกชื่อลูกค้า' }, { status: 400 });
    }
    const severity = body.severity as Severity;
    if (!SEVERITY_VALUES.includes(severity)) {
      return NextResponse.json({ ok: false, error: 'กรุณาเลือกความรุนแรงของปัญหา' }, { status: 400 });
    }
    const photoLinks: PhotoLink[] = Array.isArray(body.photoLinks) ? body.photoLinks : [];
    if (!photoLinks.some((p) => p?.category === 'problem_evidence')) {
      return NextResponse.json({ ok: false, error: 'กรุณาแนบภาพหลักฐานปัญหาอย่างน้อย 1 รูป' }, { status: 400 });
    }
    if (customerPhone && !THAI_MOBILE_RE.test(customerPhone)) {
      return NextResponse.json({ ok: false, error: 'เบอร์โทรลูกค้าไม่ถูกต้อง (ต้องเป็นเลข 10 หลัก ขึ้นต้นด้วย 0)' }, { status: 400 });
    }
    const reporterPhoneDigits = String(body.reporterPhone ?? '').replace(/[^0-9]/g, '');
    if (reporterPhoneDigits && !THAI_MOBILE_RE.test(reporterPhoneDigits)) {
      return NextResponse.json({ ok: false, error: 'เบอร์โทรผู้แจ้งไม่ถูกต้อง (ต้องเป็นเลข 10 หลัก ขึ้นต้นด้วย 0)' }, { status: 400 });
    }

    const dealerIdForLookup = seesAllDealers(session.role) ? (body.dealerId ?? null) : session.dealerId;

    // Zero-leakage: if the vehicle exists but belongs to another dealer, treat it as not found.
    const vehicle = await getVehicleBySerial(serial, dealerIdForLookup);
    if (vehicle && dealerIdForLookup && vehicle.dealer_id && vehicle.dealer_id !== dealerIdForLookup) {
      return NextResponse.json({ ok: false, error: 'หมายเลขรถนี้ไม่ได้อยู่ในดีลเลอร์ของคุณ' }, { status: 403 });
    }

    const hours = body.hours === '' || body.hours === undefined || body.hours === null ? null : Number(body.hours);
    const hoursInForRepair =
      body.hoursInForRepair === '' || body.hoursInForRepair === undefined || body.hoursInForRepair === null
        ? null
        : Number(body.hoursInForRepair);
    if (hours !== null && hoursInForRepair !== null && hoursInForRepair < hours) {
      return NextResponse.json(
        { ok: false, error: 'ชั่วโมงการใช้งานขณะนำเข้าซ่อม ต้องไม่น้อยกว่าชั่วโมงขณะพบปัญหา' },
        { status: 400 }
      );
    }

    const warranty = calcWarranty(vehicle?.delivery_date ?? null, foundDate, problemSystem);

    const record = await createRecord(
      {
        serial,
        model: String(body.model ?? vehicle?.model ?? ''),
        hours,
        foundDate,
        problemCode,
        problemSystem,
        warrantyStatus: warranty.status,
        severity,
        peripheralEquipment: body.peripheralEquipment ? String(body.peripheralEquipment) : null,
        customerName,
        customerPhone,
        reporterName: String(body.reporterName ?? ''),
        reporterPhone: reporterPhoneDigits,
        attachment: String(body.attachment ?? ''),
        stockNote: vehicle ? null : String(body.stockNote ?? ''),
        lat: body.lat === undefined || body.lat === null || body.lat === '' ? null : Number(body.lat),
        lng: body.lng === undefined || body.lng === null || body.lng === '' ? null : Number(body.lng),
        photoLinks,
        videoLink: body.videoLink ? String(body.videoLink) : null,
        dealerId: dealerIdForLookup,
        branchId: body.branchId ? String(body.branchId) : null,
        technicianId: body.technicianId ? String(body.technicianId) : null,
        repairDate,
        hoursInForRepair,
      },
      session
    );

    return NextResponse.json({ ok: true, record, warranty });
  } catch (err: any) {
    console.error('create record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

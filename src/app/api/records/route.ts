import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createRecord, getVehicleBySerial, getDealer } from '@/lib/db';
import { calcWarranty } from '@/lib/warranty';
import { seesAllDealers } from '@/lib/scope';
import { PhotoLink, Severity } from '@/lib/types';
import { sendRecordNotification } from '@/lib/email';
import { relocatePendingFiles } from '@/lib/googleDrive';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';

const SEVERITY_VALUES: Severity[] = ['Critical', 'Major', 'Minor'];

const THAI_MOBILE_RE = /^0[0-9]{9}$/;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  if (!seesAllDealers(session.role) && !session.dealerId) {
    return NextResponse.json({ ok: false, error: translate(locale, 'validation.userNotLinkedToDealer') }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: translate(locale, 'validation.requiredVehicleFoundDateProblem') }, { status: 400 });
    }
    if (!repairDate) {
      return NextResponse.json({ ok: false, error: translate(locale, 'validation.requiredRepairDate') }, { status: 400 });
    }
    if (new Date(repairDate) < new Date(foundDate)) {
      return NextResponse.json({ ok: false, error: translate(locale, 'validation.repairDateBeforeFound') }, { status: 400 });
    }
    if (!customerName) {
      return NextResponse.json({ ok: false, error: translate(locale, 'validation.enterCustomerName') }, { status: 400 });
    }
    const severity = body.severity as Severity;
    if (!SEVERITY_VALUES.includes(severity)) {
      return NextResponse.json({ ok: false, error: translate(locale, 'validation.selectSeverity') }, { status: 400 });
    }
    const photoLinks: PhotoLink[] = Array.isArray(body.photoLinks) ? body.photoLinks : [];
    const REQUIRED_PHOTO_CATEGORIES = ['odometer', 'vehicle_serial', 'damage_point_1'];
    const presentCategories = new Set(photoLinks.map((p) => p?.category));
    if (REQUIRED_PHOTO_CATEGORIES.some((c) => !presentCategories.has(c as any))) {
      return NextResponse.json(
        { ok: false, error: translate(locale, 'validation.requiredDamagePhotos') },
        { status: 400 }
      );
    }
    if (customerPhone && !THAI_MOBILE_RE.test(customerPhone)) {
      return NextResponse.json({ ok: false, error: translate(locale, 'validation.invalidCustomerPhone') }, { status: 400 });
    }
    const reporterPhoneDigits = String(body.reporterPhone ?? '').replace(/[^0-9]/g, '');
    if (reporterPhoneDigits && !THAI_MOBILE_RE.test(reporterPhoneDigits)) {
      return NextResponse.json({ ok: false, error: translate(locale, 'validation.invalidReporterPhone') }, { status: 400 });
    }

    const dealerIdForLookup = seesAllDealers(session.role) ? (body.dealerId ?? null) : session.dealerId;

    // Zero-leakage: if the vehicle exists but belongs to another dealer, treat it as not found.
    const vehicle = await getVehicleBySerial(serial, dealerIdForLookup);
    if (vehicle && dealerIdForLookup && vehicle.dealer_id && vehicle.dealer_id !== dealerIdForLookup) {
      return NextResponse.json({ ok: false, error: translate(locale, 'validation.serialNotInYourDealer') }, { status: 403 });
    }

    const hours = body.hours === '' || body.hours === undefined || body.hours === null ? null : Number(body.hours);
    const hoursInForRepair =
      body.hoursInForRepair === '' || body.hoursInForRepair === undefined || body.hoursInForRepair === null
        ? null
        : Number(body.hoursInForRepair);
    if (hours !== null && hoursInForRepair !== null && hoursInForRepair < hours) {
      return NextResponse.json(
        { ok: false, error: translate(locale, 'validation.repairHoursLessThanFound') },
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
        gpsAccuracy:
          body.gpsAccuracy === undefined || body.gpsAccuracy === null || body.gpsAccuracy === ''
            ? null
            : Number(body.gpsAccuracy),
        googleMapsUrl: body.googleMapsUrl ? String(body.googleMapsUrl) : null,
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

    // Per spec section 8: send the PDF report email as soon as the job is
    // reported. A failed/unconfigured email must never fail the create.
    let dealer = null;
    try {
      dealer = await getDealer(record.dealer_id);
      await sendRecordNotification(record, dealer?.full_name, new URL(req.url).origin, 'created');
    } catch (err) {
      console.error('notification email error (create)', err);
    }

    // Photos/video were uploaded into the dealer's "_pending" Drive folder
    // before this record (and its job_id) existed - move them into the
    // proper {dealer}/{jobId} folder now. File IDs/URLs never change, so
    // this never needs to touch the DB row. Never fails the create.
    try {
      const dealerFolderName = (dealer?.short_name || record.dealer_id).replace(/[^a-zA-Z0-9ก-๙_-]/g, '');
      await relocatePendingFiles(dealerFolderName, record.job_id, [
        ...(record.photo_links ?? []).map((p) => p.url),
        record.video_link,
      ]);
    } catch (err) {
      console.error('drive relocate pending files error', err);
    }

    return NextResponse.json({ ok: true, record, warranty });
  } catch (err: any) {
    console.error('create record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? translate(locale, 'validation.internalSystemError') }, { status: 500 });
  }
}

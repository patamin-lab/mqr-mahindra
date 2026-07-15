import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRecordByJobId, updateRecord, softDeleteRecord, getVehicleBySerial } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { calcWarranty } from '@/lib/warranty';
import { MasterDataService } from '@/shared/master-data';
import { canUpdateStatus, canDelete } from '@/lib/scope';
import { PhotoLink, Severity } from '@/lib/types';
import { sendRecordNotification } from '@/lib/email';
import { AttachmentService } from '@/shared/attachments';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { THAI_MOBILE_REGEX } from '@/lib/validation';

const attachmentService = new AttachmentService();

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
    return NextResponse.json({ ok: false, error: translate(getLocaleFromCookieHeader(req.headers.get('cookie')), 'validation.recordNotFound') }, { status: 404 });
  }
  return NextResponse.json({ ok: true, record });
}

export async function PATCH(req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  if (!canUpdateStatus(session.role)) {
    return NextResponse.json({ ok: false, error: translate(locale, 'validation.unauthorizedUpdateStatus') }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (body.severity !== undefined && body.severity !== null && !SEVERITY_VALUES.includes(body.severity)) {
      return NextResponse.json({ ok: false, error: translate(locale, 'validation.invalidSeverity') }, { status: 400 });
    }
    const addPhotoLinks: PhotoLink[] | undefined = Array.isArray(body.addPhotoLinks)
      ? body.addPhotoLinks
      : undefined;
    const removePhotoUrls: string[] | undefined = Array.isArray(body.removePhotoUrls)
      ? body.removePhotoUrls.filter((u: unknown) => typeof u === 'string')
      : undefined;

    const jobId = decodeURIComponent(params.jobId);
    const before = await getRecordByJobId(jobId, session);
    const wasAlreadyClosed = before ? CLOSING_STATUSES.has(before.status) : false;

    // Edit Report (reuses the create form in edit mode - always sends
    // `serial`, unlike the status-only Update Status form) - same
    // validations as the create route (api/records/route.ts), applied
    // here since this is the only other path that writes these fields.
    let editFields: Record<string, unknown> = {};
    if (body.serial !== undefined) {
      const serial = String(body.serial ?? '').trim();
      const foundDate = String(body.foundDate ?? '').trim();
      const problemCode = String(body.problemCode ?? '').trim();
      const customerName = String(body.customerName ?? '').trim();
      const customerPhone = String(body.customerPhone ?? '').replace(/[^0-9]/g, '');
      const reporterPhoneDigits = String(body.reporterPhone ?? '').replace(/[^0-9]/g, '');
      const repairDate = String(body.repairDate ?? '').trim();

      if (!serial || !foundDate || !problemCode) {
        return NextResponse.json({ ok: false, error: translate(locale, 'validation.requiredVehicleFoundDateProblem') }, { status: 400 });
      }
      if (!customerName) {
        return NextResponse.json({ ok: false, error: translate(locale, 'validation.enterCustomerName') }, { status: 400 });
      }
      if (customerPhone && !THAI_MOBILE_REGEX.test(customerPhone)) {
        return NextResponse.json({ ok: false, error: translate(locale, 'validation.invalidCustomerPhone') }, { status: 400 });
      }
      if (reporterPhoneDigits && !THAI_MOBILE_REGEX.test(reporterPhoneDigits)) {
        return NextResponse.json({ ok: false, error: translate(locale, 'validation.invalidReporterPhone') }, { status: 400 });
      }
      if (!repairDate) {
        return NextResponse.json({ ok: false, error: translate(locale, 'validation.requiredRepairDate') }, { status: 400 });
      }
      if (repairDate < foundDate) {
        return NextResponse.json({ ok: false, error: translate(locale, 'validation.repairDateBeforeFound') }, { status: 400 });
      }
      const hours = body.hours === '' || body.hours === undefined || body.hours === null ? null : Number(body.hours);
      const hoursInForRepair =
        body.hoursInForRepair === '' || body.hoursInForRepair === undefined || body.hoursInForRepair === null
          ? null
          : Number(body.hoursInForRepair);
      if (hours !== null && hoursInForRepair !== null && hoursInForRepair < hours) {
        return NextResponse.json({ ok: false, error: translate(locale, 'validation.repairHoursLessThanFound') }, { status: 400 });
      }

      // Same vehicle lookup pattern as the create route (api/records/route.ts) -
      // used only to re-derive warranty status against the (possibly
      // changed) vehicle/found date. Dealer is never reassigned via edit
      // (see UpdateRecordInput's doc comment).
      const vehicle = await getVehicleBySerial(serial, resolveDealerScope(session, null));
      const problemSystem = body.problemSystem === 'powertrain' ? 'powertrain' : 'other';
      const warranty = calcWarranty(vehicle?.delivery_date ?? null, foundDate, problemSystem);

      editFields = {
        serial,
        model: String(body.model ?? vehicle?.model ?? ''),
        hours,
        foundDate,
        problemCode,
        problemSystem,
        warrantyStatus: warranty.status,
        customerName,
        customerPhone,
        reporterName: String(body.reporterName ?? ''),
        reporterPhone: reporterPhoneDigits,
        attachment: String(body.attachment ?? ''),
        stockNote: body.stockNote ? String(body.stockNote) : null,
        lat: body.lat === undefined || body.lat === null || body.lat === '' ? null : Number(body.lat),
        lng: body.lng === undefined || body.lng === null || body.lng === '' ? null : Number(body.lng),
        gpsAccuracy:
          body.gpsAccuracy === undefined || body.gpsAccuracy === null || body.gpsAccuracy === '' ? null : Number(body.gpsAccuracy),
        googleMapsUrl: body.googleMapsUrl ? String(body.googleMapsUrl) : null,
        videoLink: body.videoLink ?? null,
        videoAttachmentId: body.videoAttachmentId ?? null,
        technicianId: body.technicianId ? String(body.technicianId) : null,
        repairDate,
        hoursInForRepair,
      };
    }

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
        removePhotoUrls,
        ...editFields,
      },
      session,
      locale
    );

    const justClosed = !wasAlreadyClosed && CLOSING_STATUSES.has(record.status);
    if (justClosed) {
      try {
        const dealer = await MasterDataService.getDealerById(record.dealer_id);
        await sendRecordNotification(record, dealer?.full_name, new URL(req.url).origin, 'closed');
      } catch (err) {
        console.error('notification email error (closed)', err);
      }

      // Starts the retention clock (see docs/engineering/ATTACHMENT_FRAMEWORK.md
      // / attachment_retention_policies) - a Market Quality Report's
      // attachments are "business complete" once the job is closed, not
      // when the record was first created.
      try {
        const attachmentIds = [
          ...(record.photo_links ?? []).map((p) => p.attachmentId).filter((id): id is string => !!id),
          ...(record.video_attachment_id ? [record.video_attachment_id] : []),
        ];
        await Promise.all(attachmentIds.map((id) => attachmentService.markBusinessComplete(id)));
      } catch (err) {
        console.error('attachment business-complete error', err);
      }
    }

    // Photos actually removed this update (present before, absent now) -
    // delete their underlying attachment for real via AttachmentService.
    // Only applies to photos uploaded through the Attachment Platform
    // (have an attachmentId); a pre-migration photo with only a raw URL
    // is just dropped from the list, exactly as before this migration.
    if (removePhotoUrls && removePhotoUrls.length > 0 && before) {
      const removedIds = (before.photo_links ?? [])
        .filter((p) => removePhotoUrls.includes(p.url) && p.attachmentId)
        .map((p) => p.attachmentId as string);
      await Promise.all(
        removedIds.map((id) =>
          attachmentService.delete(id).catch((err) => console.error('attachment delete error', err))
        )
      );
    }

    return NextResponse.json({ ok: true, record });
  } catch (err: any) {
    console.error('update record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? translate(locale, 'validation.internalSystemError') }, { status: 500 });
  }
}

/** Soft delete only (sets record_status = 'Deleted' + audit fields) — never a hard delete. */
export async function DELETE(req: NextRequest, { params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  if (!canDelete(session.role)) {
    return NextResponse.json({ ok: false, error: translate(locale, 'validation.unauthorizedDelete') }, { status: 403 });
  }
  try {
    await softDeleteRecord(decodeURIComponent(params.jobId), session);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('delete record error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? translate(locale, 'validation.internalSystemError') }, { status: 500 });
  }
}

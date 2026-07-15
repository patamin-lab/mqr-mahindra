import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isNonEmptyString, parseWithSchema, ValidationError } from '@/lib/validation';
import { resolveDealerScope, assertBranchAccess } from '@/lib/dealerBranchScope';
import { buildNtrRecordCreateBodySchema, NtrRecordCreateBody } from '@/features/ntr/schemas';
import { NtrRecordCreateInput } from '@/features/ntr/types';
import { createNtrService } from '@/features/ntr/factory';
import { runNtrWarrantyOrchestration } from '@/features/ntr/services/ntrPostCreateOrchestration';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { AttachmentService } from '@/shared/attachments';
import { unauthorizedError } from '@/lib/apiError';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } }, { status: 400 });
  }

  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));

  // Zero-leakage: only a privileged role may set an arbitrary dealer_id -
  // everyone else is pinned to their own session dealer.
  const { dealerId } = resolveDealerScope(session, typeof body.dealer_id === 'string' ? body.dealer_id.trim() : undefined);
  if (!isNonEmptyString(dealerId)) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'dealer_id is required' } }, { status: 400 });
  }

  let parsedBody: NtrRecordCreateBody;
  try {
    parsedBody = parseWithSchema<NtrRecordCreateBody>(buildNtrRecordCreateBodySchema(locale), body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 });
    }
    throw error;
  }

  // The tractor's own branch_id (from the selected/created Tractor, not a
  // scope filter) must actually belong to the resolved dealer - closes a
  // spoofed cross-dealer branch_id from a privileged role's request body.
  try {
    await assertBranchAccess(dealerId, parsedBody.branch_id ?? null);
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'branch_id does not belong to dealer_id' } }, { status: 400 });
  }

  // receiving_person/pdi_date/manufacturing_year/video_url/
  // video_attachment_id/retail_date are no longer collected by the manual
  // registration form (NTR Form Update, 2026-07 - Delivery Date is the
  // Delivery section's only, required date field) - explicitly null here
  // rather than accepted from the request body. `NtrRecordCreateInput`
  // keeps these fields because Legacy Import (a separate create path)
  // still populates them.
  const input: NtrRecordCreateInput = {
    dealer_id: dealerId,
    ...parsedBody,
    receiving_person: null,
    pdi_date: null,
    manufacturing_year: null,
    video_url: null,
    video_attachment_id: null,
    retail_date: null,
    source: 'manual',
  };

  const service = createNtrService();

  try {
    const record = await service.create(input, { username: session.username, role: session.role });

    // Photos/video were uploaded via AttachmentService against a temporary
    // client-generated entity ID before this record existed - re-tag them
    // with the record's real id now (mirrors src/app/api/pm-records/route.ts's
    // identical pattern). A tractor registration is a single, already-complete
    // event, so its attachments' retention clock starts immediately. Neither
    // step may fail the create.
    try {
      const attachmentService = new AttachmentService();
      const attachmentIds = [
        record.photo_customer_id_attachment_id,
        record.photo_customer_tractor_attachment_id,
        record.photo_serial_plate_attachment_id,
        record.photo_hour_meter_attachment_id,
        record.photo_signed_document_attachment_id,
        record.video_attachment_id,
        ...record.additional_photos.map((p) => p.attachmentId ?? null),
      ].filter((id): id is string => !!id);
      if (attachmentIds.length > 0) {
        await attachmentService.reassignEntity(attachmentIds, record.id);
        await Promise.all(attachmentIds.map((id) => attachmentService.markBusinessComplete(id)));
      }
    } catch (err) {
      console.error('attachment reassign/business-complete error (ntr-record)', err);
    }

    // Business-domain correction: NTR is the ownership-transfer event and
    // the sole legitimate trigger for Warranty Activation - never manual
    // (docs/architecture/DELIVERY_PLATFORM.md). Shared with Legacy
    // Import's own commit path (`NtrImportService.commit()`) so both
    // NTR-creation paths run identical orchestration. `runNtrWarrantyOrchestration`
    // already never throws on its own, but this call is still wrapped
    // here (same defense-in-depth as the attachment reassign block above)
    // so an NTR record can never fail to save even if that contract is
    // ever broken.
    try {
      await runNtrWarrantyOrchestration(record, { username: session.username, role: session.role });
    } catch (err) {
      console.error('NTR post-create warranty/PM orchestration error (ntr-record route)', err);
    }

    return NextResponse.json({ ok: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('NTR record create error', error);
    const message = error instanceof Error ? error.message : translate(locale, 'validation.internalSystemError');
    // A duplicate-serial rejection from the service layer is a real,
    // actor-facing message (not a generic 500) - same pattern as PM's
    // lock-violation handling.
    const isDuplicate = message.includes('already registered');
    return NextResponse.json(
      { ok: false, error: { code: isDuplicate ? 'CONFLICT' : 'INTERNAL_ERROR', message } },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}

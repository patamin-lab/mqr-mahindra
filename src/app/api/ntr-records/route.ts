import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { isNonEmptyString, parseWithSchema, ValidationError } from '@/lib/validation';
import { buildNtrRecordCreateBodySchema, NtrRecordCreateBody } from '@/features/ntr/schemas';
import { NtrRecordCreateInput } from '@/features/ntr/types';
import { createNtrService } from '@/features/ntr/factory';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import { AttachmentService } from '@/shared/attachments';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
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
  const dealerId = seesAllDealers(session.role) ? String(body.dealer_id ?? '').trim() : session.dealerId;
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

  const input: NtrRecordCreateInput = {
    dealer_id: dealerId,
    ...parsedBody,
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
        record.photo_customer_tractor_attachment_id,
        record.photo_serial_plate_attachment_id,
        record.photo_hour_meter_attachment_id,
        record.photo_signed_document_attachment_id,
        record.video_attachment_id,
      ].filter((id): id is string => !!id);
      if (attachmentIds.length > 0) {
        await attachmentService.reassignEntity(attachmentIds, record.id);
        await Promise.all(attachmentIds.map((id) => attachmentService.markBusinessComplete(id)));
      }
    } catch (err) {
      console.error('attachment reassign/business-complete error (ntr-record)', err);
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

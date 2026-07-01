import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { getDealer } from '@/lib/db';
import { relocatePendingFiles } from '@/lib/googleDrive';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecordService } from '@/features/pm-record/service';
import { isNonEmptyString, parseWithSchema, ValidationError } from '@/features/pm-record/validation';
import { PmRecordCreateBodySchema, PmRecordCreateBody } from '@/features/pm-record/schemas';
import { PmRecordCreateInput } from '@/features/pm-record/types';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } },
      { status: 401 }
    );
  }

  const repository = new SupabasePmRecordRepository();
  const service = new PmRecordService(repository);

  try {
    const data = await service.list();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    console.error('PM Record list API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } },
      { status: 400 }
    );
  }

  // Zero-leakage: only a privileged role may set an arbitrary dealer_id from
  // the request body — everyone else is pinned to their own session dealer,
  // mirroring the same rule already enforced in src/app/api/records/route.ts.
  // dealer_id is resolved here, not via the schema below, because schema
  // validation can only check shape - not who is allowed to set what.
  const dealerId = seesAllDealers(session.role) ? String(body.dealer_id ?? '').trim() : session.dealerId;
  if (!isNonEmptyString(dealerId)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'dealer_id is required' } },
      { status: 400 }
    );
  }

  let parsedBody: PmRecordCreateBody;
  try {
    parsedBody = parseWithSchema<PmRecordCreateBody>(PmRecordCreateBodySchema, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } },
        { status: 400 }
      );
    }
    throw error;
  }

  const input: PmRecordCreateInput = {
    dealer_id: dealerId,
    ...parsedBody,
  };

  const repository = new SupabasePmRecordRepository();
  const service = new PmRecordService(repository);

  try {
    const record = await service.create(input, { username: session.username });

    // Photos were uploaded into the dealer's "_pending" Drive folder before
    // this record (and its pm_number) existed - move them into the proper
    // {dealer}/{pmNumber} folder now, mirroring src/app/api/records/route.ts's
    // identical pattern for QIR photos. File URLs never change, so this
    // never needs to touch the DB row, and a relocate failure must never
    // fail the create (the photos still work from _pending either way).
    try {
      const dealer = await getDealer(record.dealer_id);
      const dealerFolderName = (dealer?.short_name || record.dealer_id).replace(/[^a-zA-Z0-9ก-๙_-]/g, '');
      if (record.pm_number) {
        await relocatePendingFiles(dealerFolderName, record.pm_number, [
          record.meter_photo_url,
          record.nameplate_photo_url,
          record.report_photo_url,
        ]);
      }
    } catch (err) {
      console.error('drive relocate pending files error (pm-record)', err);
    }

    return NextResponse.json({ ok: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('PM Record create API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}

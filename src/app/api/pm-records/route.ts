import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecordService } from '@/features/pm-record/service';
import { isNonEmptyString } from '@/features/pm-record/validation';
import { PmRecordCreateInput } from '@/features/pm-record/types';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const repository = new SupabasePmRecordRepository();
  const service = new PmRecordService(repository);

  try {
    const data = await service.list();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    console.error('PM Record list API error', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
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
  const dealerId = seesAllDealers(session.role) ? String(body.dealer_id ?? '').trim() : session.dealerId;
  if (!isNonEmptyString(dealerId)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'dealer_id is required' } },
      { status: 400 }
    );
  }
  if (!isNonEmptyString(body.status)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'status is required' } },
      { status: 400 }
    );
  }

  const input: PmRecordCreateInput = {
    dealer_id: dealerId,
    branch_id: isNonEmptyString(body.branch_id) ? body.branch_id : null,
    serial: isNonEmptyString(body.serial) ? body.serial : null,
    technician_id: isNonEmptyString(body.technician_id) ? body.technician_id : null,
    scheduled_date: isNonEmptyString(body.scheduled_date) ? body.scheduled_date : null,
    status: body.status,
    notes: isNonEmptyString(body.notes) ? body.notes : null,
  };

  const repository = new SupabasePmRecordRepository();
  const service = new PmRecordService(repository);

  try {
    const record = await service.create(input, { username: session.username });
    return NextResponse.json({ ok: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('PM Record create API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}

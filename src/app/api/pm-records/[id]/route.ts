import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecordService } from '@/features/pm-record/service';
import { isNonEmptyString } from '@/features/pm-record/validation';
import { PmRecordUpdateInput } from '@/features/pm-record/types';

/** PM Record single-item route — structure only (Sprint 10.1). See
 *  ../route.ts for the same scope note. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const repository = new SupabasePmRecordRepository();
  const service = new PmRecordService(repository);

  try {
    const record = await service.getById(params.id);
    if (!record) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: record }, { status: 200 });
  } catch (error) {
    console.error('PM Record detail API error', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: false, error: 'not implemented', id: params.id }, { status: 501 });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
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

  const input: PmRecordUpdateInput = {};
  if ('branch_id' in body) input.branch_id = isNonEmptyString(body.branch_id) ? body.branch_id : null;
  if ('serial' in body) input.serial = isNonEmptyString(body.serial) ? body.serial : null;
  if ('technician_id' in body) input.technician_id = isNonEmptyString(body.technician_id) ? body.technician_id : null;
  if ('scheduled_date' in body) {
    input.scheduled_date = isNonEmptyString(body.scheduled_date) ? body.scheduled_date : null;
  }
  if ('performed_date' in body) {
    input.performed_date = isNonEmptyString(body.performed_date) ? body.performed_date : null;
  }
  if ('notes' in body) input.notes = isNonEmptyString(body.notes) ? body.notes : null;
  if ('status' in body) {
    if (!isNonEmptyString(body.status)) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'status must be a non-empty string' } },
        { status: 400 }
      );
    }
    input.status = body.status;
  }

  const repository = new SupabasePmRecordRepository();
  const service = new PmRecordService(repository);

  try {
    const existing = await service.getById(params.id);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } },
        { status: 404 }
      );
    }

    const record = await service.update(params.id, input, { username: session.username });
    return NextResponse.json({ ok: true, data: record }, { status: 200 });
  } catch (error) {
    console.error('PM Record update API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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
    const existing = await service.getById(params.id);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } },
        { status: 404 }
      );
    }

    await service.delete(params.id, { username: session.username });
    return NextResponse.json({ ok: true, data: null }, { status: 200 });
  } catch (error) {
    console.error('PM Record delete API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}

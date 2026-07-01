import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecordService } from '@/features/pm-record/service';
import { parseWithSchema, ValidationError } from '@/features/pm-record/validation';
import { PmRecordUpdateBodySchema, PmRecordUpdateBody } from '@/features/pm-record/schemas';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
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
    const record = await service.getById(params.id);
    if (!record) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, data: record }, { status: 200 });
  } catch (error) {
    console.error('PM Record detail API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
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

  let input: PmRecordUpdateBody;
  try {
    input = parseWithSchema<PmRecordUpdateBody>(PmRecordUpdateBodySchema, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } },
        { status: 400 }
      );
    }
    throw error;
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

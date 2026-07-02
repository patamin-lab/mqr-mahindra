import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService, MaintenanceLockError } from '@/features/maintenance/services/maintenanceService';
import { parseWithSchema, ValidationError } from '@/features/maintenance/utils/validation';
import { buildMaintenanceRecordUpdateBodySchema, MaintenanceRecordUpdateBody } from '@/features/maintenance/schemas';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } },
      { status: 401 }
    );
  }

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

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

  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } },
      { status: 400 }
    );
  }

  let input: MaintenanceRecordUpdateBody;
  try {
    input = parseWithSchema<MaintenanceRecordUpdateBody>(buildMaintenanceRecordUpdateBodySchema(locale), body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } },
        { status: 400 }
      );
    }
    throw error;
  }

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  try {
    const existing = await service.getById(params.id);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } },
        { status: 404 }
      );
    }

    const record = await service.update(params.id, input, { username: session.username, role: session.role }, locale);
    return NextResponse.json({ ok: true, data: record }, { status: 200 });
  } catch (error) {
    console.error('PM Record update API error', error);
    // A lock violation is a real, actor-facing message thrown by the
    // Service layer - surface it as-is rather than a generic 500, same as
    // MQR's update route already does for its own thrown errors.
    // Detected via a distinct error type, not by sniffing the (now
    // localized, so language-dependent) message text.
    const isLockViolation = error instanceof MaintenanceLockError;
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json(
      { ok: false, error: { code: isLockViolation ? 'LOCKED' : 'INTERNAL_ERROR', message } },
      { status: isLockViolation ? 409 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } },
      { status: 401 }
    );
  }

  // Locked records require a mandatory reason (enforced in the Service
  // layer) - unlocked records ignore a missing/empty body entirely, same
  // as before this sprint.
  let reason: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.reason === 'string') reason = body.reason;
  } catch {
    // No JSON body sent - fine, delete-button.tsx doesn't send one for an
    // unlocked record.
  }

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));

  try {
    const existing = await service.getById(params.id);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } },
        { status: 404 }
      );
    }

    await service.delete(params.id, { username: session.username, role: session.role }, reason, locale);
    return NextResponse.json({ ok: true, data: null }, { status: 200 });
  } catch (error) {
    console.error('PM Record delete API error', error);
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecordService } from '@/features/pm-record/service';

/**
 * POST /api/pm-records
 *
 * Creates a new PM Record.
 *
 * Auth:    getSession() — 401 if no valid session.
 * Scope:   dealer_id is always taken from session.dealerId (never the request
 *          body). SuperAdmin / CentralAdmin (dealerId = null) receive 403 until
 *          a dealer picker UI is added in a future sprint.
 * Format:  { success: true, data: PmRecord }
 *          { success: false, error: { code, message } }
 */

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export async function GET() {
  const session = await getSession();
  if (!session) return err('UNAUTHORIZED', 'unauthorized', 401);
  // List is out of scope for Sprint 11.2 — placeholder for future sprint.
  return err('NOT_IMPLEMENTED', 'list not yet implemented', 501);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return err('UNAUTHORIZED', 'unauthorized', 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err('BAD_REQUEST', 'Invalid JSON body');
  }

  try {
    const repository = new SupabasePmRecordRepository();
    const service = new PmRecordService(repository);

    const record = await service.create(
      {
        branch_id: null,
        serial: typeof body.serial === 'string' ? body.serial : null,
        model: typeof body.model === 'string' ? body.model : null,
        delivery_date:
          typeof body.delivery_date === 'string' ? body.delivery_date : null,
        customer_name:
          typeof body.customer_name === 'string' ? body.customer_name : null,
        customer_phone:
          typeof body.customer_phone === 'string' ? body.customer_phone : null,
        scheduled_date:
          typeof body.scheduled_date === 'string' ? body.scheduled_date : '',
        notes: typeof body.notes === 'string' ? body.notes : null,
      },
      { username: session.username, dealerId: session.dealerId },
    );

    return ok(record, 201);
  } catch (e: unknown) {
    const error = e as { code?: string; message?: string };
    const code = error?.code ?? 'INTERNAL_ERROR';
    const message = error?.message ?? 'เกิดข้อผิดพลาดในระบบ';
    const status =
      code === 'DEALER_REQUIRED'
        ? 403
        : code === 'VALIDATION_ERROR'
        ? 422
        : 500;
    console.error('POST /api/pm-records error', e);
    return err(code, message, status);
  }
}

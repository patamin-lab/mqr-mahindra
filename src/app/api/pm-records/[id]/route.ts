import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecordService } from '@/features/pm-record/service';

/**
 * GET /api/pm-records/[id]
 *
 * Returns a single PM Record by ID.
 *
 * Auth:    getSession() — 401 if no valid session.
 * Scope:   dealer isolation enforced in service layer — DealerAdmin /
 *          DealerUser receive 403 if the record belongs to a different dealer.
 *          SuperAdmin / CentralAdmin (dealerId = null) can read any record.
 * Format:  { success: true, data: PmRecord }
 *          { success: false, error: { code, message } }
 */

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return err('UNAUTHORIZED', 'unauthorized', 401);

  try {
    const repository = new SupabasePmRecordRepository();
    const service = new PmRecordService(repository);
    const record = await service.getById(params.id, {
      username: session.username,
      dealerId: session.dealerId,
    });
    return ok(record);
  } catch (e: unknown) {
    const error = e as { code?: string; message?: string };
    const code = error?.code ?? 'INTERNAL_ERROR';
    const message = error?.message ?? 'เกิดข้อผิดพลาดในระบบ';
    const status =
      code === 'FORBIDDEN' ? 403
      : code === 'NOT_FOUND' ? 404
      : 500;
    return err(code, message, status);
  }
}

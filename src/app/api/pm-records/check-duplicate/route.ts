import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecordService } from '@/features/pm-record/service';

/** Pre-save duplicate check (same tractor + PM interval + performed date) -
 *  a warning only, never a hard block; the client decides whether to show
 *  "Continue anyway" based on this response. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const serial = searchParams.get('serial');
  const pmIntervalId = searchParams.get('pmIntervalId');
  const performedDate = searchParams.get('performedDate');
  if (!serial || !pmIntervalId || !performedDate) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'serial, pmIntervalId, and performedDate are required' } },
      { status: 400 }
    );
  }

  const repository = new SupabasePmRecordRepository();
  const service = new PmRecordService(repository);

  try {
    const existing = await service.findDuplicate({ serial, pmIntervalId, performedDate });
    return NextResponse.json({ ok: true, data: { duplicate: existing } }, { status: 200 });
  } catch (error) {
    console.error('PM Record duplicate check error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}

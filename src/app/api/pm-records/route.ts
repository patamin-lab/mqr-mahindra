import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecordService } from '@/features/pm-record/service';

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

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: false, error: 'not implemented' }, { status: 501 });
}

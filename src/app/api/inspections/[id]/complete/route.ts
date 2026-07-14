import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { InspectionService } from '@/features/inspection';

const service = new InspectionService();

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const updated = await service.completeInspection(params.id, session);
    return NextResponse.json({ ok: true, inspection: updated });
  } catch (err: any) {
    console.error('complete inspection error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not access Import Inspection');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : 400 });
  }
}

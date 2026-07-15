import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { InspectionService } from '@/features/inspection';

const service = new InspectionService();

/** Inspection-level Factory Feedback - the overall narrative summary sent
 *  back to the factory/import side. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const feedback = String(body.feedback ?? '').trim();
    if (!feedback) {
      return NextResponse.json({ ok: false, error: 'feedback is required' }, { status: 400 });
    }
    const updated = await service.recordFactoryFeedback(params.id, feedback, session);
    return NextResponse.json({ ok: true, inspection: updated });
  } catch (err: any) {
    console.error('record factory feedback error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not access Import Inspection');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : 400 });
  }
}

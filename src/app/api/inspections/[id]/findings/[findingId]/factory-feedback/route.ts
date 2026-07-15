import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { InspectionService, type FindingDisposition, type FactoryFeedbackStatus } from '@/features/inspection';

const service = new InspectionService();

/** Factory Feedback Model (per-finding) - disposition, factory feedback
 *  status, and corrective action reference. Distinct from the finding's
 *  own description and from the inspection-level Factory Feedback
 *  narrative (`[id]/factory-feedback`). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; findingId: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const updated = await service.updateFindingFactoryFeedback(
      params.id,
      params.findingId,
      {
        disposition: body.disposition as FindingDisposition | undefined,
        factoryFeedbackStatus: body.factoryFeedbackStatus as FactoryFeedbackStatus | undefined,
        correctiveActionReference: body.correctiveActionReference !== undefined ? (body.correctiveActionReference ? String(body.correctiveActionReference) : null) : undefined,
      },
      session
    );
    return NextResponse.json({ ok: true, inspection: updated });
  } catch (err: any) {
    console.error('update finding factory feedback error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not access Import Inspection');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : 400 });
  }
}

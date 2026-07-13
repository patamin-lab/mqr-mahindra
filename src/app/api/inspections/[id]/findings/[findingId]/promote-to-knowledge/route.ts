import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { InspectionService } from '@/features/inspection';

const service = new InspectionService();

/** Structured Findings may become Knowledge Candidates - "do not
 *  duplicate entry" (task brief). Calls
 *  `InspectionService.promoteFindingToKnowledge()`, which itself calls
 *  the existing `KnowledgeService.createCandidate()`/`.addEvidence()` -
 *  no parallel Knowledge-entry form exists. */
export async function POST(_req: NextRequest, { params }: { params: { id: string; findingId: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const updated = await service.promoteFindingToKnowledge(params.id, params.findingId, session);
    return NextResponse.json({ ok: true, inspection: updated });
  } catch (err: any) {
    console.error('promote finding to knowledge error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 400 });
  }
}

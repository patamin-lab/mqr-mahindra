import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { KnowledgeService, KNOWLEDGE_MATURITY_VALUES, type KnowledgeMaturity } from '@/features/knowledge';

const service = new KnowledgeService();

/** The Engineering Review action (and every other maturity move — submit
 *  for review, send back to Draft, deprecate, archive). Body:
 *  `{ maturity: KnowledgeMaturity, supersededByCaseId?: string }`.
 *  `KnowledgeService.transitionMaturity()` enforces
 *  `canTransitionKnowledgeMaturity` server-side — the only real gate;
 *  the UI only hides buttons the role can't use. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const maturity = body.maturity as KnowledgeMaturity;
    if (!KNOWLEDGE_MATURITY_VALUES.includes(maturity)) {
      return NextResponse.json({ ok: false, error: `maturity must be one of ${KNOWLEDGE_MATURITY_VALUES.join(', ')}` }, { status: 400 });
    }
    const supersededByCaseId = body.supersededByCaseId ? String(body.supersededByCaseId) : null;

    const updated = await service.transitionMaturity(params.id, maturity, session, supersededByCaseId);
    return NextResponse.json({ ok: true, case: updated });
  } catch (err: any) {
    console.error('transition knowledge case maturity error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not move');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : 500 });
  }
}

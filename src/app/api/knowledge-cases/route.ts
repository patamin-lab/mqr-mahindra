import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { KnowledgeService, type KnowledgeMaturity } from '@/features/knowledge';

const service = new KnowledgeService();

/** List Knowledge Cases (Candidates and Cases alike — both are the same
 *  table, filtered by `maturity`). Platform-wide, not dealer-scoped (see
 *  KNOWLEDGE_PLATFORM.md §9) — every authenticated role may browse
 *  Knowledge. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  const { searchParams } = new URL(req.url);
  const maturity = searchParams.get('maturity') as KnowledgeMaturity | null;
  const q = searchParams.get('q') ?? undefined;
  const productFamilyId = searchParams.get('productFamilyId') ?? undefined;

  try {
    const cases = await service.listCases({ maturity: maturity ?? undefined, q, productFamilyId });
    return NextResponse.json({ ok: true, cases });
  } catch (err: any) {
    console.error('list knowledge cases error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}

/** Creates a Knowledge Candidate (`maturity: 'Draft'`) — open to every
 *  role, see `canTransitionKnowledgeMaturity`'s doc comment in
 *  `features/knowledge/types.ts`. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  try {
    const body = await req.json();
    const symptom = String(body.symptom ?? '').trim();
    if (!symptom) {
      return NextResponse.json({ ok: false, error: 'symptom is required' }, { status: 400 });
    }
    const possibleCauses = Array.isArray(body.possibleCauses)
      ? body.possibleCauses.filter((c: any) => typeof c?.cause === 'string' && c.cause.trim().length > 0)
      : [];

    const created = await service.createCandidate(
      {
        symptom,
        affectedSystem: body.affectedSystem ? String(body.affectedSystem) : null,
        productFamilyId: body.productFamilyId ? String(body.productFamilyId) : null,
        model: body.model ? String(body.model) : null,
        possibleCauses,
      },
      session
    );
    return NextResponse.json({ ok: true, case: created }, { status: 201 });
  } catch (err: any) {
    console.error('create knowledge candidate error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}

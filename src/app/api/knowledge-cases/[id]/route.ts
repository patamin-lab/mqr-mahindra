import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { KnowledgeService } from '@/features/knowledge';
import { canReviewKnowledge } from '@/lib/scope';

const service = new KnowledgeService();

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const detail = await service.getCase(params.id);
    return NextResponse.json({ ok: true, ...detail });
  } catch (err: any) {
    console.error('get knowledge case error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'not found' }, { status: 404 });
  }
}

/** Edits a case's own fields. Once `maturity === 'Published'`, only a
 *  `canReviewKnowledge` role may edit it (reuses the Engineering Review
 *  boundary as the field-edit lock, rather than inventing a second lock
 *  mechanism the way PM Records has its own `locked_at`). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const existing = await service.getCase(params.id);
    if (existing.case.maturity === 'Published' && !canReviewKnowledge(session.role)) {
      return NextResponse.json({ ok: false, error: 'A Published Knowledge Case can only be edited by Engineering Review' }, { status: 403 });
    }

    const body = await req.json();
    const patch: Parameters<KnowledgeService['updateCase']>[1] = {};
    if (body.symptom !== undefined) patch.symptom = String(body.symptom).trim();
    if (body.affectedSystem !== undefined) patch.affectedSystem = body.affectedSystem ? String(body.affectedSystem) : null;
    if (body.productFamilyId !== undefined) patch.productFamilyId = body.productFamilyId ? String(body.productFamilyId) : null;
    if (body.model !== undefined) patch.model = body.model ? String(body.model) : null;
    if (Array.isArray(body.possibleCauses)) patch.possibleCauses = body.possibleCauses;
    if (body.validatedFix !== undefined) patch.validatedFix = body.validatedFix ? String(body.validatedFix) : null;
    if (Array.isArray(body.verificationSteps)) patch.verificationSteps = body.verificationSteps;
    if (body.confidence !== undefined) patch.confidence = body.confidence;

    const updated = await service.updateCase(params.id, patch, session);
    return NextResponse.json({ ok: true, case: updated });
  } catch (err: any) {
    console.error('update knowledge case error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { KnowledgeService, type KnowledgeEvidenceSourceType } from '@/features/knowledge';

const service = new KnowledgeService();

const SOURCE_TYPES: KnowledgeEvidenceSourceType[] = ['Quality', 'PM', 'Warranty', 'Machine', 'Dealer', 'Customer', 'Engineer', 'IoT'];

/** Adds one Evidence item to a Knowledge Case. Any attachment is uploaded
 *  separately via the existing generic `/api/attachments` route (`module:
 *  'knowledge'`, `entityType: 'evidence'`, `entityId: <the returned
 *  evidence id>`) once this row exists - this route only ever writes
 *  `knowledge_evidence`, never a storage provider directly (Attachment
 *  Platform, ADR-010). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const sourceType = body.sourceType as KnowledgeEvidenceSourceType;
    if (!SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json({ ok: false, error: `sourceType must be one of ${SOURCE_TYPES.join(', ')}` }, { status: 400 });
    }
    const summary = String(body.summary ?? '').trim();
    if (!summary) {
      return NextResponse.json({ ok: false, error: 'summary is required' }, { status: 400 });
    }
    const sourceModule = body.sourceModule && ['mqr', 'pm', 'ntr'].includes(body.sourceModule) ? body.sourceModule : null;
    const observedAt = body.observedAt ? String(body.observedAt) : new Date().toISOString().slice(0, 10);

    const detail = await service.addEvidence(
      params.id,
      {
        sourceType,
        sourceModule,
        sourceRecordId: body.sourceRecordId ? String(body.sourceRecordId) : null,
        machineSerial: body.machineSerial ? String(body.machineSerial) : null,
        observedAt,
        confidence: body.confidence ?? null,
        summary,
      },
      session
    );
    return NextResponse.json({ ok: true, ...detail }, { status: 201 });
  } catch (err: any) {
    console.error('add knowledge evidence error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}

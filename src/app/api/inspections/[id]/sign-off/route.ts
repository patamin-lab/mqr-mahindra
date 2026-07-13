import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { InspectionService } from '@/features/inspection';

const service = new InspectionService();

/** Digital Sign-off — the technician confirming a Completed inspection.
 *  Open to any authenticated role that performed it; Dealer Approval
 *  (below) is the trust-conferring, gated action. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const updated = await service.signOff(params.id, session);
    return NextResponse.json({ ok: true, inspection: updated });
  } catch (err: any) {
    console.error('sign off inspection error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { InspectionService } from '@/features/inspection';

const service = new InspectionService();

/** Digital Sign-off — the technician confirming a Completed inspection.
 *  MSEAL-only, like every Import Inspection action (`canAccessImportInspection`,
 *  enforced inside `InspectionService`). */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  try {
    const updated = await service.signOff(params.id, session);
    return NextResponse.json({ ok: true, inspection: updated });
  } catch (err: any) {
    console.error('sign off inspection error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not access Import Inspection');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : 400 });
  }
}

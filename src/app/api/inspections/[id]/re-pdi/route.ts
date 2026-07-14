import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { InspectionService, type InspectionReason } from '@/features/inspection';

const service = new InspectionService();

/** RE-PDI — a new, immutable inspection event chained to the one it
 *  follows (`params.id` becomes `previousInspectionId`). Never overwrites
 *  the previous inspection. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const technicianName = String(body.technicianName ?? session.fullName ?? session.username).trim();
    const created = await service.createRePdi(
      params.id,
      {
        reason: (body.reason as InspectionReason) ?? 'STORAGE_EXPIRED',
        technicianId: body.technicianId ? String(body.technicianId) : null,
        technicianName,
        technicianCertificationRef: body.technicianCertificationRef ? String(body.technicianCertificationRef) : null,
      },
      session
    );
    return NextResponse.json({ ok: true, inspection: created }, { status: 201 });
  } catch (err: any) {
    console.error('create re-pdi error', err);
    const forbidden = typeof err?.message === 'string' && err.message.includes('may not access Import Inspection');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: forbidden ? 403 : 400 });
  }
}

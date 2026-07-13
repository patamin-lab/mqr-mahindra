import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { DeliveryService } from '@/features/delivery';

const service = new DeliveryService();

/** Operator Training (stage 6) — Training Topics/Operator/Trainer/
 *  Training Photos/Videos (via the existing Attachment Platform,
 *  module: 'delivery')/Training Duration/Customer Satisfaction. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const operatorName = String(body.operatorName ?? '').trim();
    const trainerName = String(body.trainerName ?? '').trim();
    if (!operatorName || !trainerName) {
      return NextResponse.json({ ok: false, error: 'operatorName and trainerName are required' }, { status: 400 });
    }
    const trainingTopics = Array.isArray(body.trainingTopics)
      ? body.trainingTopics.filter((t: any) => typeof t?.topic === 'string' && t.topic.trim().length > 0)
      : [];

    const updated = await service.recordTraining(
      params.id,
      {
        operatorName,
        operatorPhone: body.operatorPhone ? String(body.operatorPhone) : null,
        trainerName,
        trainerId: body.trainerId ? String(body.trainerId) : null,
        trainingTopics,
        trainingDate: body.trainingDate ? String(body.trainingDate) : new Date().toISOString().slice(0, 10),
        trainingDurationMinutes: body.trainingDurationMinutes ? Number(body.trainingDurationMinutes) : null,
        customerSatisfactionScore: body.customerSatisfactionScore ? Number(body.customerSatisfactionScore) : null,
        notes: body.notes ? String(body.notes) : null,
      },
      session
    );
    return NextResponse.json({ ok: true, delivery: updated });
  } catch (err: any) {
    console.error('record training error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 400 });
  }
}

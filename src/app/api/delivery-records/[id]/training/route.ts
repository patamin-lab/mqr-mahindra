import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { seesAllDealers } from '@/lib/scope';
import { DeliveryService, type RecordTrainingRequest, type TrainingTopic } from '@/features/delivery';

const service = new DeliveryService();

function toTrainingTopics(input: unknown): TrainingTopic[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((t): t is { topic?: unknown; covered?: unknown } => typeof t === 'object' && t !== null)
    .map((t) => ({ topic: String(t.topic ?? '').trim(), covered: t.covered === true }))
    .filter((t) => t.topic.length > 0);
}

/** Operator Training capture (stage 6). `DeliveryService.recordTraining()`
 *  is unchanged (ADR-027) - this route only surfaces it over HTTP and
 *  validates the required fields the service itself expects. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  try {
    const existing = await service.getDelivery(params.id);
    if (!seesAllDealers(session.role) && session.dealerId !== existing.dealerId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await req.json();
    const operatorName = String(body.operatorName ?? '').trim();
    const trainerName = String(body.trainerName ?? '').trim();
    const trainingDate = String(body.trainingDate ?? '').trim();
    if (!operatorName || !trainerName || !trainingDate) {
      return NextResponse.json({ ok: false, error: 'operatorName, trainerName, and trainingDate are required' }, { status: 400 });
    }

    const input: RecordTrainingRequest = {
      operatorName,
      operatorPhone: body.operatorPhone ? String(body.operatorPhone).trim() : null,
      trainerName,
      trainerId: body.trainerId ? String(body.trainerId).trim() : null,
      trainingTopics: toTrainingTopics(body.trainingTopics),
      trainingDate,
      trainingDurationMinutes: body.trainingDurationMinutes != null ? Number(body.trainingDurationMinutes) : null,
      customerSatisfactionScore: body.customerSatisfactionScore != null ? Number(body.customerSatisfactionScore) : null,
      notes: body.notes ? String(body.notes).trim() : null,
    };

    const updated = await service.recordTraining(params.id, input, session);
    return NextResponse.json({ ok: true, record: updated });
  } catch (err: any) {
    console.error('record training error', err);
    const notFound = typeof err?.message === 'string' && err.message.includes('not found');
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: notFound ? 404 : 400 });
  }
}

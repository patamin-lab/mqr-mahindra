import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVehicleBySerial } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { createVehicleEventPublisher, createVehicleEventService } from '@/features/vehicle-event/factory';
import { parseWithSchema, ValidationError } from '@/features/vehicle-event/validation';
import { VehicleEventPublishBodySchema, VehicleEventUpdateBodySchema } from '@/features/vehicle-event/schemas';
import { EVENT_CODES, VehicleEventFilter } from '@/features/vehicle-event/types';

function unauthorized() {
  return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
}

function numberOrNull(value: string | null): number | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * `GET /api/platform/events` — server-side paginated/filtered search over
 * `vehicle_events`, dealer-scoped exactly like every other listing endpoint
 * in this app (a non-privileged caller is pinned to their own dealer,
 * regardless of what `vehicleId`/`serial` they pass).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);

  const { dealerId: dealerScope } = resolveDealerScope(session, null);

  let vehicleId = searchParams.get('vehicleId');
  const serial = searchParams.get('serial');
  if (!vehicleId && serial) {
    const vehicle = await getVehicleBySerial(serial, dealerScope);
    if (!vehicle) {
      return NextResponse.json({ ok: true, data: [], total: 0 }, { status: 200 });
    }
    vehicleId = vehicle.id;
  }

  const filter: VehicleEventFilter = {
    dealerId: dealerScope,
    vehicleId,
    sourceModule: searchParams.get('sourceModule'),
    eventDefinitionId: searchParams.get('eventDefinitionId'),
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    search: searchParams.get('search'),
    page: numberOrNull(searchParams.get('page')) ?? 1,
    pageSize: numberOrNull(searchParams.get('pageSize')) ?? 25,
  };

  const service = createVehicleEventService();

  try {
    const result = await service.searchEvents(filter);
    return NextResponse.json({ ok: true, data: result.data, total: result.total }, { status: 200 });
  } catch (error) {
    console.error('Vehicle Event search API error', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } }, { status: 500 });
  }
}

/**
 * `POST /api/platform/events` — routes through `VehicleEventPublisher`
 * (never `VehicleEventService.createEvent()` directly), so callers identify
 * the vehicle/event type by `serial`/`eventCode`, matching how every other
 * `publish*` call site will eventually work.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } }, { status: 400 });
  }

  let parsedBody;
  try {
    parsedBody = parseWithSchema<{
      eventCode: (typeof EVENT_CODES)[number];
      serial: string;
      sourceModule: string;
      referenceId: string;
      eventDatetime?: string | null;
      title: string;
      description?: string | null;
      metadata?: Record<string, unknown>;
      status?: string | null;
    }>(VehicleEventPublishBodySchema, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 });
    }
    throw error;
  }

  const publisher = createVehicleEventPublisher();

  try {
    const event = await publisher.publish({
      eventCode: parsedBody.eventCode,
      serial: parsedBody.serial,
      sourceModule: parsedBody.sourceModule,
      referenceId: parsedBody.referenceId,
      eventDatetime: parsedBody.eventDatetime ?? undefined,
      title: parsedBody.title,
      description: parsedBody.description ?? null,
      metadata: parsedBody.metadata ?? {},
      status: parsedBody.status ?? null,
      actor: { username: session.username },
    });
    return NextResponse.json({ ok: true, data: event }, { status: 201 });
  } catch (error) {
    console.error('Vehicle Event publish API error', error);
    const message = error instanceof Error ? error.message : 'internal error';
    const isNotFound = message.startsWith('Cannot publish event:');
    return NextResponse.json(
      { ok: false, error: { code: isNotFound ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR', message } },
      { status: isNotFound ? 400 : 500 }
    );
  }
}

/** `PUT /api/platform/events` — a direct partial patch via
 *  `VehicleEventService.updateEvent()`. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } }, { status: 400 });
  }

  let parsedBody;
  try {
    parsedBody = parseWithSchema<{
      id: string;
      eventDatetime?: string;
      title?: string;
      description?: string | null;
      metadata?: Record<string, unknown> | null;
      status?: string | null;
    }>(VehicleEventUpdateBodySchema, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 });
    }
    throw error;
  }

  const service = createVehicleEventService();

  try {
    const { id, ...patch } = parsedBody;
    const event = await service.updateEvent(id, patch, { username: session.username });
    return NextResponse.json({ ok: true, data: event }, { status: 200 });
  } catch (error) {
    console.error('Vehicle Event update API error', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } }, { status: 500 });
  }
}

/** `DELETE /api/platform/events?id=...` — soft delete only. */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'id is required' } }, { status: 400 });
  }

  const service = createVehicleEventService();

  try {
    await service.deleteEvent(id, { username: session.username });
    return NextResponse.json({ ok: true, data: null }, { status: 200 });
  } catch (error) {
    console.error('Vehicle Event delete API error', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } }, { status: 500 });
  }
}

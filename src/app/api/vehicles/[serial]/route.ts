import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getVehicleBySerial, getVehicleHistory } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';

export async function GET(req: NextRequest, { params }: { params: { serial: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const serial = decodeURIComponent(params.serial);
  const vehicle = await getVehicleBySerial(serial, seesAllDealers(session.role) ? null : session.dealerId);
  if (!vehicle) {
    return NextResponse.json({ ok: false, found: false });
  }
  const history = await getVehicleHistory(serial, session);
  return NextResponse.json({ ok: true, found: true, vehicle, historyCount: history.length });
}

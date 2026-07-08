import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';

/** Address Platform - backs the shared `AddressSelector`'s Province step.
 *  Served via API rather than queried client-side since `AddressRepository`
 *  (Supabase-backed, ADR-011 v2) is server-only - never shipped to the
 *  browser. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  return NextResponse.json({ ok: true, provinces: await MasterDataService.listProvinces() });
}

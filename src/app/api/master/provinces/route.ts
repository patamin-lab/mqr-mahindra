import { NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';

/** Address Platform - backs the shared `AddressSelector`'s Province step.
 *  Served via API rather than queried client-side since `AddressRepository`
 *  (Supabase-backed, ADR-011 v2) is server-only - never shipped to the
 *  browser. */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorizedError();

  return NextResponse.json({ ok: true, provinces: await MasterDataService.listProvinces() });
}

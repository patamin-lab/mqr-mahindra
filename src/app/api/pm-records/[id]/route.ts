import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/** PM Record single-item route — structure only (Sprint 10.1). See
 *  ../route.ts for the same scope note. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: false, error: 'not implemented', id: params.id }, { status: 501 });
}

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: false, error: 'not implemented', id: params.id }, { status: 501 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: false, error: 'not implemented', id: params.id }, { status: 501 });
}

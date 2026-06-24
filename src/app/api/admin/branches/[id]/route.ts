import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { updateBranch } from '@/lib/db';
import { seesAllDealers, canManageMasterData } from '@/lib/scope';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  if (!canManageMasterData(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    if (!seesAllDealers(session.role)) {
      // Dealer Admin: verify the branch belongs to their own dealer before allowing the edit.
      const supabase = getSupabase();
      const { data: existing } = await supabase.from('branches').select('dealer_id').eq('id', params.id).maybeSingle();
      if (!existing || existing.dealer_id !== session.dealerId) {
        return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึงสาขานี้' }, { status: 403 });
      }
    }
    const body = await req.json();
    const branch = await updateBranch(params.id, { code: body.code, name: body.name, active: body.active }, session);
    return NextResponse.json({ ok: true, branch });
  } catch (err: any) {
    console.error('update branch error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

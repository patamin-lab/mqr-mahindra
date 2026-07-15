import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError, forbiddenError } from '@/lib/apiError';
import { getSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { updateTechnician } from '@/lib/db';
import { canManageMasterData } from '@/lib/scope';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!canManageMasterData(session.role)) {
    return forbiddenError();
  }
  try {
    const supabase = getSupabase();
    const { data: existing } = await supabase.from('technicians').select('dealer_id').eq('id', params.id).maybeSingle();
    if (!existing || !canAccessDealerBranch(session, existing.dealer_id, null)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึงช่างคนนี้' }, { status: 403 });
    }
    const body = await req.json();
    const technician = await updateTechnician(
      params.id,
      { code: body.code, name: body.name, mobile: body.mobile, branch: body.branch, active: body.active },
      session
    );
    return NextResponse.json({ ok: true, technician });
  } catch (err: any) {
    console.error('update technician error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}

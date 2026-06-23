import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabase, STORAGE_BUCKET } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const label = String(form.get('label') ?? 'file');
  if (!file) {
    return NextResponse.json({ ok: false, error: 'ไม่พบไฟล์' }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'ไฟล์มีขนาดใหญ่เกินไป (จำกัด 25MB)' }, { status: 400 });
  }

  const supabase = getSupabase();
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const safeDealer = (session.dealerId ?? 'na').replace(/[^a-zA-Z0-9_-]/g, '');
  const path = `${safeDealer}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buf = await file.arrayBuffer();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, label });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabase, STORAGE_BUCKET } from '@/lib/supabase';
import convertHeic from 'heic-convert';

const HEIC_EXTENSIONS = new Set(['heic', 'heif']);
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

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

  let ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  let contentType = file.type || 'application/octet-stream';
  let buf = Buffer.from(await file.arrayBuffer());

  // iPhones commonly upload HEIC/HEIF photos, which most browsers and PDF
  // renderers can't display - convert to JPEG server-side so every photo in
  // the system is universally viewable downstream (records page, PDF export).
  const isHeic = HEIC_EXTENSIONS.has(ext) || HEIC_MIME_TYPES.has(contentType.toLowerCase());
  if (isHeic) {
    try {
      const converted = await convertHeic({ buffer: buf, format: 'JPEG', quality: 0.85 });
      buf = Buffer.from(converted);
      ext = 'jpg';
      contentType = 'image/jpeg';
    } catch (err) {
      console.error('heic convert error', err);
      return NextResponse.json({ ok: false, error: 'ไม่สามารถแปลงไฟล์ HEIC/HEIF นี้ได้' }, { status: 400 });
    }
  }

  const supabase = getSupabase();
  const safeDealer = (session.dealerId ?? 'na').replace(/[^a-zA-Z0-9_-]/g, '');
  const path = `${safeDealer}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buf, {
    contentType,
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, label });
}

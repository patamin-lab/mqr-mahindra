import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDealer } from '@/lib/db';
import { uploadFileToDrive } from '@/lib/googleDrive';
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
  const dealerId = String(form.get('dealerId') ?? '').trim();
  const jobId = form.get('jobId') ? String(form.get('jobId')).trim() : undefined;

  if (!file) {
    return NextResponse.json({ ok: false, error: 'ไม่พบไฟล์' }, { status: 400 });
  }

  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'ไฟล์มีขนาดใหญ่เกินไป (จำกัด 25MB)' }, { status: 400 });
  }

  let ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  let contentType = file.type || 'application/octet-stream';
  let buf = Buffer.from(await file.arrayBuffer());

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

  let dealerFolderName = 'na';
  if (dealerId) {
    const dealer = await getDealer(dealerId);
    dealerFolderName = (dealer?.short_name || dealerId).replace(/[^a-zA-Z0-9ก-๙_-]/g, '');
  }
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const { url } = await uploadFileToDrive({
      buffer: buf,
      filename,
      mimeType: contentType,
      dealerFolderName,
      jobId,
    });
    return NextResponse.json({ ok: true, url, label });
  } catch (err: any) {
    console.error('google drive upload error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'อัปโหลดขึ้น Google Drive ไม่สำเร็จ' }, { status: 500 });
  }
}

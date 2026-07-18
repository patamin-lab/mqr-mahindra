import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError, forbiddenError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { AttachmentService, AttachmentType, toUserFacingAttachmentError, canAccessAttachment } from '@/shared/attachments';
import convertHeic from 'heic-convert';

const HEIC_EXTENSIONS = new Set(['heic', 'heif']);
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;

const ATTACHMENT_TYPES = new Set<AttachmentType>([
  'MasterData',
  'MeterPhoto',
  'NameplatePhoto',
  'ReportPhoto',
  'DefectPhoto',
  'RepairPhoto',
  'CustomerSignature',
  'Invoice',
  'Warranty',
  'Video',
  'Audio',
  'Pdf',
  'Excel',
  'Other',
  'CustomerTractorPhoto',
  'SerialPlatePhoto',
  'HourMeterPhoto',
  'DeliverySheetPhoto',
  'CustomerIdCardPhoto',
  'BookingDocumentPhoto',
  'TaxInvoicePhoto',
  'CrmLeadScreenshotPhoto',
]);

const attachmentService = new AttachmentService();

/**
 * Small (<=4MB) single-shot upload - mirrors `/api/upload`'s existing HEIC
 * conversion, minus everything Drive/folder-specific (see
 * `docs/engineering/ATTACHMENT_FRAMEWORK.md`). Files above this size use
 * `/api/attachments/upload/init` + a direct browser PUT instead (see that
 * route) - the same reason `/api/upload/init` existed for Google Drive.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const moduleName = String(form.get('module') ?? '').trim();
  const entityType = String(form.get('entityType') ?? '').trim();
  const entityId = String(form.get('entityId') ?? '').trim();
  const attachmentType = String(form.get('attachmentType') ?? '') as AttachmentType;

  if (!file || !moduleName || !entityType || !entityId || !ATTACHMENT_TYPES.has(attachmentType)) {
    return NextResponse.json({ ok: false, error: 'Invalid attachment upload request' }, { status: 400 });
  }
  if (file.size > MAX_DIRECT_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'File too large for direct upload - use /api/attachments/upload/init' }, { status: 400 });
  }

  let filename = file.name || 'file';
  let mimeType = file.type || 'application/octet-stream';
  let buffer = Buffer.from(await file.arrayBuffer());

  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (HEIC_EXTENSIONS.has(ext) || HEIC_MIME_TYPES.has(mimeType.toLowerCase())) {
    try {
      buffer = Buffer.from(await convertHeic({ buffer, format: 'JPEG', quality: 0.85 }));
      filename = `${filename.replace(/\.[^.]+$/, '')}.jpg`;
      mimeType = 'image/jpeg';
    } catch (err) {
      return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'upload') }, { status: 400 });
    }
  }

  try {
    const attachment = await attachmentService.upload({
      module: moduleName,
      entityType,
      entityId,
      attachmentType,
      filename,
      mimeType,
      buffer,
      createdBy: session.username,
    });
    const resolved = await attachmentService.getUrl(attachment.id);
    return NextResponse.json({ ok: true, attachment, url: resolved?.url ?? null });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'upload') }, { status: 500 });
  }
}

/** Lists attachments for one business entity, each with a freshly-resolved
 *  display URL - callers (module pages, shared presentation components) never resolve
 *  a URL themselves. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  const { searchParams } = new URL(req.url);
  const moduleName = searchParams.get('module');
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  if (!moduleName || !entityType || !entityId) {
    return NextResponse.json({ ok: false, error: 'module, entityType, and entityId are required' }, { status: 400 });
  }
  if (!(await canAccessAttachment({ module: moduleName, entityId }, session))) return forbiddenError();

  try {
    const attachments = await attachmentService.list(moduleName, entityType, entityId);
    const withUrls = await Promise.all(
      attachments.map(async (attachment) => {
        const resolved = await attachmentService.getUrl(attachment.id).catch(() => null);
        return { ...attachment, url: resolved?.url ?? null };
      })
    );
    return NextResponse.json({ ok: true, attachments: withUrls });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toUserFacingAttachmentError(err, 'access') }, { status: 500 });
  }
}

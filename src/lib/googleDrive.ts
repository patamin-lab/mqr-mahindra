import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Google Drive storage for report photos/videos, replacing Supabase Storage
 * per the dealer's request. Files are organized as:
 *   {ROOT_FOLDER}/{dealerShortName}/{jobId}/{filename}
 * New-report uploads happen before a job_id exists, so they land in a
 * per-dealer "_pending" folder first and get re-parented into the real
 * job folder by `relocatePendingFiles` once the record is created.
 *
 * Required env vars (set in Vercel + .env.local — never hard-code these):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  - the service account's client_email
 *   GOOGLE_PRIVATE_KEY            - the service account's private_key
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID   - ID of a Drive folder that a real Google
 *                                   account has already shared with the
 *                                   service account email as Editor
 */

const PENDING_FOLDER_NAME = '_pending';

function driveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY env var is not set');
  }
  const key = rawKey.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

function rootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!id) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID env var is not set');
  return id;
}

/** Finds a child folder by exact name under `parentId`, creating it if absent. */
async function getOrCreateFolder(
  drive: ReturnType<typeof driveClient>,
  name: string,
  parentId: string
): Promise<string> {
  const safeName = name.replace(/'/g, "\\'");
  const list = await drive.files.list({
    q: `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    supportsAllDrives: false,
    includeItemsFromAllDrives: true,
    spaces: 'drive',
  });
  const existing = list.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: false,
  });
  if (!created.data.id) throw new Error('สร้างโฟลเดอร์ใน Google Drive ไม่สำเร็จ');
  return created.data.id;
}

function fileUrlFor(fileId: string, mimeType: string): string {
  return mimeType.startsWith('image/')
    ? `https://drive.google.com/uc?export=view&id=${fileId}`
    : `https://drive.google.com/file/d/${fileId}/view`;
}

export function driveFileIdFromUrl(url: string): string | null {
  const uc = url.match(/[?&]id=([^&]+)/);
  if (uc) return uc[1];
  const view = url.match(/\/file\/d\/([^/]+)/);
  if (view) return view[1];
  return null;
}

export interface DriveUploadParams {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  dealerFolderName: string;
  jobId?: string | null;
}

export async function uploadFileToDrive(params: DriveUploadParams): Promise<{ url: string; fileId: string }> {
  const drive = driveClient();
  const dealerFolderId = await getOrCreateFolder(drive, params.dealerFolderName, rootFolderId());
  const targetFolderId = await getOrCreateFolder(drive, params.jobId || PENDING_FOLDER_NAME, dealerFolderId);

  const created = await drive.files.create({
    requestBody: { name: params.filename, parents: [targetFolderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: 'id',
    supportsAllDrives: false,
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error('อัปโหลดไฟล์ขึ้น Google Drive ไม่สำเร็จ');

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: false,
  });

  return { url: fileUrlFor(fileId, params.mimeType), fileId };
}

export async function relocatePendingFiles(
  dealerFolderName: string,
  jobId: string,
  urls: (string | null | undefined)[]
): Promise<void> {
  const fileIds = urls
    .filter((u): u is string => !!u && u.includes('drive.google.com'))
    .map(driveFileIdFromUrl)
    .filter((id): id is string => !!id);
  if (fileIds.length === 0) return;

  const drive = driveClient();
  const dealerFolderId = await getOrCreateFolder(drive, dealerFolderName, rootFolderId());
  const pendingFolderId = await getOrCreateFolder(drive, PENDING_FOLDER_NAME, dealerFolderId);
  const jobFolderId = await getOrCreateFolder(drive, jobId, dealerFolderId);

  await Promise.all(
    fileIds.map((fileId) =>
      drive.files.update({
        fileId,
        addParents: jobFolderId,
        removeParents: pendingFolderId,
        supportsAllDrives: false,
      })
    )
  );
}

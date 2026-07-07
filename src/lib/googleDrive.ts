import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Google Drive access - now used exclusively as the Attachment Platform's
 * archive-tier `StorageProvider` (`GoogleDriveStorageProvider`), never
 * called directly by a business module. Every module's direct-upload
 * path (formerly `uploadFileSmart.ts`/`/api/upload*`, which called
 * `uploadFileToDrive()`/`initResumableUpload()`/`relocatePendingFiles()`
 * below) has migrated onto `AttachmentService`, whose primary storage is
 * Supabase/R2, not Drive - see `docs/architecture/PLATFORM_CONSTITUTION.md`.
 * Files are organized as {ROOT_FOLDER}/{dealerFolderName}/{jobId-or-_pending}/
 * {filename} - the "_pending" fallback and job-folder relocation concept
 * predate this narrowing and are unused by the archive tier (which always
 * passes a fixed `dealerFolderName` and no `jobId`), but are harmless,
 * inert code paths, not removed since `uploadFileToDrive()` still relies
 * on the same folder-resolution helper.
 *
 * Auth: OAuth2 as a real Google account, NOT a service account. Service
 * accounts have zero Drive storage quota of their own - on a personal
 * Gmail (non-Workspace) account there's no Shared Drive and no domain-wide
 * delegation to fall back on, so every upload attempt fails with "Service
 * Accounts do not have storage quota". Authenticating as the real account
 * that owns the destination folder sidesteps this entirely.
 *
 * One-time setup: run `node scripts/get-google-refresh-token.mjs` locally
 * (see that file for instructions) to mint GOOGLE_OAUTH_REFRESH_TOKEN.
 *
 * Required env vars (set in Vercel + .env.local - never hard-code these):
 *   GOOGLE_OAUTH_CLIENT_ID      - OAuth client ID (type "Desktop app")
 *   GOOGLE_OAUTH_CLIENT_SECRET  - OAuth client secret
 *   GOOGLE_OAUTH_REFRESH_TOKEN  - minted once via the script above, while
 *                                 logged in as the Gmail account that owns
 *                                 the destination folder
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID - ID of a folder in that same account's
 *                                 My Drive (no sharing step needed - we
 *                                 authenticate as the owner directly)
 */

const PENDING_FOLDER_NAME = '_pending';

/** The bare OAuth2 client, exposed separately so callers that need a raw
 *  access token (e.g. to hit a Drive REST endpoint directly via `fetch`
 *  instead of through the `googleapis` SDK) don't have to reach into the
 *  `drive` SDK instance's internals. */
function oauthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN env var is not set'
    );
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

function driveClient() {
  return google.drive({ version: 'v3', auth: oauthClient() });
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
    supportsAllDrives: true,
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
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error('สร้างโฟลเดอร์ใน Google Drive ไม่สำเร็จ');
  return created.data.id;
}

/** Resolves {dealerFolderName}/{jobId-or-_pending}, creating either as needed. */
async function resolveTargetFolderId(
  drive: ReturnType<typeof driveClient>,
  dealerFolderName: string,
  jobId?: string | null
): Promise<string> {
  const dealerFolderId = await getOrCreateFolder(drive, dealerFolderName, rootFolderId());
  return getOrCreateFolder(drive, jobId || PENDING_FOLDER_NAME, dealerFolderId);
}

function fileUrlFor(fileId: string, mimeType: string): string {
  // Images render inline (e.g. <img src>, react-pdf <Image>). Drive's old
  // `uc?export=view` link frequently serves an HTML interstitial instead of
  // raw image bytes when hit from an <img src>, which is why thumbnails were
  // showing as broken icons. The `thumbnail` endpoint reliably returns actual
  // image bytes for publicly-shared files; `sz=w2000` keeps resolution high
  // enough for the PDF export too. Non-images (video) keep the normal Drive
  // viewer page link.
  return mimeType.startsWith('image/')
    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`
    : `https://drive.google.com/file/d/${fileId}/view`;
}

/** Whether a file ID still exists (and isn't trashed) on Drive - used by
 *  the Attachment Platform's `exists()` (see `GoogleDriveStorageProvider`). */
export async function fileExistsOnDrive(fileId: string): Promise<boolean> {
  const drive = driveClient();
  try {
    const res = await drive.files.get({ fileId, fields: 'id,trashed', supportsAllDrives: true });
    return res.data.trashed !== true;
  } catch (err: any) {
    if (err?.code === 404 || err?.response?.status === 404) return false;
    throw err;
  }
}

/** Lists every file ID directly under one named folder (created via
 *  `getOrCreateFolder()` if it doesn't already exist) - used by the
 *  Attachment Platform's `list()` for the archive folder. */
export async function listFilesInDriveFolder(folderName: string): Promise<string[]> {
  const drive = driveClient();
  const folderId = await getOrCreateFolder(drive, folderName, rootFolderId());
  const files: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      spaces: 'drive',
      pageToken,
    });
    files.push(...(res.data.files ?? []).map((f) => f.id).filter((id): id is string => !!id));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

export interface DriveUploadParams {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  dealerFolderName: string;
  /** Pass the human job_id (e.g. "QIR-2606-0001") once known; omit for
   *  new-report uploads where the record doesn't exist yet. */
  jobId?: string | null;
}

/** Uploads one file to Drive, sharing it as "anyone with the link can view". */
export async function uploadFileToDrive(params: DriveUploadParams): Promise<{ url: string; fileId: string }> {
  const drive = driveClient();
  const targetFolderId = await resolveTargetFolderId(drive, params.dealerFolderName, params.jobId);

  const created = await drive.files.create({
    requestBody: { name: params.filename, parents: [targetFolderId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: 'id',
    supportsAllDrives: true,
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error('อัปโหลดไฟล์ขึ้น Google Drive ไม่สำเร็จ');

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  return { url: fileUrlFor(fileId, params.mimeType), fileId };
}

/** Deletes one Drive file outright - used by the Attachment Platform's
 *  `delete()` when an attachment has already been archived (its bytes no
 *  longer live in Supabase Storage, only in Drive). */
export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = driveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

/** Downloads a Drive file's raw bytes back into a `Buffer` - used by the
 *  Attachment Platform's `restore()`/`verifyChecksum()` (see
 *  `docs/engineering/ATTACHMENT_FRAMEWORK.md`), which are the first
 *  callers that ever need bytes back out of Drive rather than just a
 *  share link. */
export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  const drive = driveClient();
  const res = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data as ArrayBuffer);
}

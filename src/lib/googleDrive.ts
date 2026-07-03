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

/** Extracts the Drive file ID back out of either URL shape `fileUrlFor` produces. */
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

export interface ResumableInitParams {
  filename: string;
  mimeType: string;
  dealerFolderName: string;
  jobId?: string | null;
}

/**
 * Starts a Google Drive "resumable" upload session and hands back the bare
 * session URL. The browser then PUTs the raw file bytes straight to Google
 * - never through our own Vercel function - which is what lets large
 * photos/videos (anything over Vercel's hard 4.5MB request-body cap) get
 * uploaded at all. The session URL is single-use and already scoped to
 * this one upload, so no Google credential is ever exposed to the client;
 * only our server (via `driveClient()`'s OAuth2 token) talks to Google
 * directly here.
 */
export async function initResumableUpload(
  params: ResumableInitParams
): Promise<{ sessionUrl: string }> {
  const auth = oauthClient();
  const drive = google.drive({ version: 'v3', auth });
  const targetFolderId = await resolveTargetFolderId(drive, params.dealerFolderName, params.jobId);
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('ไม่สามารถขอ access token จาก Google ได้');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType,
      },
      body: JSON.stringify({ name: params.filename, parents: [targetFolderId] }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`เริ่มอัปโหลดขึ้น Google Drive ไม่สำเร็จ (${res.status}) ${detail}`.trim());
  }

  const sessionUrl = res.headers.get('Location') || res.headers.get('location');
  if (!sessionUrl) throw new Error('ไม่ได้รับ session URL จาก Google Drive');
  return { sessionUrl };
}

/**
 * After the browser has PUT the file bytes directly to the resumable
 * session URL and gotten back a Drive file ID, this sets the "anyone with
 * the link can view" permission (which must happen server-side, with our
 * Google credentials) and returns the same URL shape `uploadFileToDrive`
 * produces, so callers can treat both upload paths identically.
 */
export async function finalizeResumableUpload(fileId: string, mimeType: string): Promise<{ url: string }> {
  const drive = driveClient();
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });
  return { url: fileUrlFor(fileId, mimeType) };
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

/**
 * After a new record is saved and its job_id is known, moves every file
 * that was uploaded into the dealer's "_pending" folder into the real
 * {dealer}/{jobId} folder. File IDs (and therefore the URLs already saved
 * on the record) never change - only the parent folder does.
 */
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
        supportsAllDrives: true,
      })
    )
  );
}

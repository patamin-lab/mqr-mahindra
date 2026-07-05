import { createHash } from 'crypto';
import { deleteFileFromDrive, downloadFileFromDrive, fileExistsOnDrive, listFilesInDriveFolder, uploadFileToDrive } from '@/lib/googleDrive';
import { StorageProvider, StoredObject } from './StorageProvider';

const ARCHIVE_FOLDER_NAME = 'attachment-archive';

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Archive-only backend (see ADR-010 - "Google Drive is no longer primary
 *  storage"). `path` from the caller is used only as the archived
 *  filename; every archived attachment lands in one flat Drive folder
 *  (`attachment-archive`) rather than mirroring Supabase's path structure,
 *  since Drive organizes by folder hierarchy, not by path string. */
export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name = 'GOOGLE_DRIVE' as const;

  async upload(params: { path: string; buffer: Buffer; mimeType: string }): Promise<StoredObject> {
    const filename = params.path.split('/').pop() ?? params.path;
    const { url, fileId } = await uploadFileToDrive({
      buffer: params.buffer,
      filename,
      mimeType: params.mimeType,
      dealerFolderName: ARCHIVE_FOLDER_NAME,
    });
    return { locator: fileId, checksum: sha256Hex(params.buffer), sizeBytes: params.buffer.byteLength, url };
  }

  async delete(locator: string): Promise<void> {
    await deleteFileFromDrive(locator);
  }

  async download(locator: string): Promise<Buffer> {
    return downloadFileFromDrive(locator);
  }

  async exists(locator: string): Promise<boolean> {
    return fileExistsOnDrive(locator);
  }

  async getSignedUrl(locator: string, mimeType: string): Promise<{ url: string; expiresAt: string | null }> {
    const isImage = mimeType.startsWith('image/');
    const url = isImage ? `https://drive.google.com/thumbnail?id=${locator}&sz=w2000` : `https://drive.google.com/file/d/${locator}/view`;
    return { url, expiresAt: null };
  }

  /** `prefix` is ignored - Drive archives everything into one flat folder
   *  (see the class doc comment), so every archived attachment is always
   *  listed regardless of what path prefix a caller passes. */
  async list(_prefix: string): Promise<string[]> {
    return listFilesInDriveFolder(ARCHIVE_FOLDER_NAME);
  }
}

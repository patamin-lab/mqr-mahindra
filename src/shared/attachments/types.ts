/**
 * Attachment Platform — shared types.
 *
 * `module` is a bare string, not a closed union: a new module (PDI,
 * Campaign, Parts, ...) starts using the platform by registering a
 * `attachment_retention_policies` row for its own module key, never by
 * editing a type here.
 */
export type AttachmentType =
  | 'MasterData'
  | 'MeterPhoto'
  | 'NameplatePhoto'
  | 'ReportPhoto'
  | 'DefectPhoto'
  | 'RepairPhoto'
  | 'CustomerSignature'
  | 'Invoice'
  | 'Warranty'
  | 'Video'
  | 'Audio'
  | 'Pdf'
  | 'Excel'
  | 'Other';

export type StorageProviderName = 'SUPABASE' | 'GOOGLE_DRIVE';

/** Archive lifecycle — see `docs/engineering/ATTACHMENT_FRAMEWORK.md`.
 *  ACTIVE -> ARCHIVE_PENDING -> ARCHIVING -> ARCHIVED -> PURGED (future). */
export type AttachmentStatus = 'ACTIVE' | 'ARCHIVE_PENDING' | 'ARCHIVING' | 'ARCHIVED' | 'PURGED';

export interface Attachment {
  id: string;
  module: string;
  entityType: string;
  entityId: string;
  attachmentType: AttachmentType;
  filename: string;
  mimeType: string;
  sizeBytes: number | null;
  checksum: string | null;
  storageProvider: StorageProviderName;
  storagePath: string | null;
  driveFileId: string | null;
  driveUrl: string | null;
  status: AttachmentStatus;
  archiveAttempts: number;
  lastArchiveAttemptAt: string | null;
  archiveError: string | null;
  archivedAt: string | null;
  businessCompletedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The URL a caller renders `<img>`/`<a>` against - resolved from whichever
 *  provider currently holds the bytes, so a module never has to branch on
 *  `storageProvider` itself. */
export interface AttachmentUrl {
  url: string;
  /** Null for a Google Drive share link (not time-limited); set for a
   *  Supabase signed URL. */
  expiresAt: string | null;
}

export interface UploadAttachmentInput {
  module: string;
  entityType: string;
  entityId: string;
  attachmentType: AttachmentType;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  createdBy?: string | null;
}

export interface RetentionPolicy {
  module: string;
  /** Null = never auto-archive (e.g. NTR). */
  retentionDays: number | null;
}

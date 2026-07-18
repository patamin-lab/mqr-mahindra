export type ImageSourceKind = 'signed' | 'cdn' | 'blob' | 'local' | 'data' | 'cached';

export type ImageResourceState = 'idle' | 'loading' | 'loaded' | 'failed' | 'expired' | 'retrying';

export interface ImageResourceError {
  message: string;
  retryCount: number;
}

/**
 * Presentation contract for a persisted or local image.
 *
 * `attachmentId` is the durable identity when the image comes from the
 * Attachment Platform. `displayUrl` is intentionally transient: it may be a
 * signed URL, CDN URL, blob URL, local preview, data URI, or cached resource.
 */
export interface ImageItem {
  id: string;
  attachmentId?: string | null;
  displayUrl: string | null;
  sourceKind: ImageSourceKind;
  filename?: string;
  mimeType: string;
  alt: string;
  label?: string;
  category?: string;
  width?: number;
  height?: number;
  expiresAt?: string | null;
  resourceState: ImageResourceState;
  error?: ImageResourceError | null;
}

export interface AttachmentResourceRequest {
  attachmentId: string;
  previous?: ImageItem;
  attempt: number;
}

export type AttachmentResourceLoader = (request: AttachmentResourceRequest) => Promise<ImageItem>;

export interface ImageResourceSnapshot {
  attachmentId: string;
  state: ImageResourceState;
  item?: ImageItem;
  error?: ImageResourceError;
  retryCount: number;
}

export interface AttachmentResourceProvider {
  get(attachmentId: string): Promise<ImageItem>;
  refresh(attachmentId: string): Promise<ImageItem>;
  invalidate(attachmentId: string): void;
  getSnapshot(attachmentId: string): ImageResourceSnapshot;
  subscribe(attachmentId: string, listener: () => void): () => void;
}

export function createImageItem(input: Omit<ImageItem, 'resourceState' | 'error'> & Partial<Pick<ImageItem, 'resourceState' | 'error'>>): ImageItem {
  return {
    ...input,
    resourceState: input.resourceState ?? (input.displayUrl ? 'loaded' : 'idle'),
    error: input.error ?? null,
  };
}

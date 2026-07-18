import type {
  AttachmentResourceLoader,
  AttachmentResourceProvider,
  ImageItem,
  ImageResourceSnapshot,
  ImageResourceState,
} from './types';

interface CacheEntry {
  state: ImageResourceState;
  item?: ImageItem;
  error?: { message: string; retryCount: number };
  retryCount: number;
}

export interface AttachmentResourceProviderOptions {
  expirySafetyMarginMs?: number;
  maxRetries?: number;
  now?: () => number;
}

/**
 * Presentation-only resource provider. It coordinates cache state and
 * bounded refresh/retry through an injected loader. The loader is the seam
 * for an authorized Attachment Platform facade; this class never knows which
 * storage provider produced a display resource.
 */
export class InMemoryAttachmentResourceProvider implements AttachmentResourceProvider {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<ImageItem>>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly expirySafetyMarginMs: number;
  private readonly maxRetries: number;
  private readonly now: () => number;

  constructor(
    private readonly loader: AttachmentResourceLoader,
    options: AttachmentResourceProviderOptions = {}
  ) {
    this.expirySafetyMarginMs = options.expirySafetyMarginMs ?? 30_000;
    this.maxRetries = Math.max(0, options.maxRetries ?? 1);
    this.now = options.now ?? (() => Date.now());
  }

  async get(attachmentId: string): Promise<ImageItem> {
    const existing = this.cache.get(attachmentId);
    if (existing?.state === 'loaded' && existing.item && !this.isExpired(existing.item)) {
      return existing.item;
    }

    if (existing?.state === 'loaded' && existing.item) {
      this.setEntry(attachmentId, { ...existing, state: 'expired' });
    }

    return this.load(attachmentId, existing?.item, existing?.state === 'expired');
  }

  async refresh(attachmentId: string): Promise<ImageItem> {
    const previous = this.cache.get(attachmentId)?.item;
    this.setEntry(attachmentId, { state: 'expired', item: previous, retryCount: 0 });
    return this.load(attachmentId, previous, true);
  }

  invalidate(attachmentId: string): void {
    this.cache.delete(attachmentId);
    this.notify(attachmentId);
  }

  getSnapshot(attachmentId: string): ImageResourceSnapshot {
    const entry = this.cache.get(attachmentId);
    if (!entry) return { attachmentId, state: 'idle', retryCount: 0 };

    if (entry.state === 'loaded' && entry.item && this.isExpired(entry.item)) {
      this.setEntry(attachmentId, { ...entry, state: 'expired' });
    }

    const current = this.cache.get(attachmentId) ?? entry;
    return {
      attachmentId,
      state: current.state,
      item: current.item,
      error: current.error,
      retryCount: current.retryCount,
    };
  }

  subscribe(attachmentId: string, listener: () => void): () => void {
    const listeners = this.listeners.get(attachmentId) ?? new Set<() => void>();
    listeners.add(listener);
    this.listeners.set(attachmentId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(attachmentId);
    };
  }

  private async load(attachmentId: string, previous: ImageItem | undefined, retrying: boolean): Promise<ImageItem> {
    const existingRequest = this.inFlight.get(attachmentId);
    if (existingRequest) return existingRequest;

    const request = this.loadWithRetries(attachmentId, previous, retrying);
    this.inFlight.set(attachmentId, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(attachmentId);
    }
  }

  private async loadWithRetries(attachmentId: string, previous: ImageItem | undefined, retrying: boolean): Promise<ImageItem> {
    for (let retryCount = 0; retryCount <= this.maxRetries; retryCount += 1) {
      this.setEntry(attachmentId, {
        state: retryCount === 0 && !retrying ? 'loading' : 'retrying',
        item: previous,
        retryCount,
      });

      try {
        const item = await this.loader({ attachmentId, previous, attempt: retryCount });
        const loaded = { ...item, attachmentId: item.attachmentId ?? attachmentId, resourceState: 'loaded' as const, error: null };
        this.setEntry(attachmentId, { state: 'loaded', item: loaded, retryCount });
        return loaded;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Image resource failed to load';
        if (retryCount === this.maxRetries) {
          const failed = { message, retryCount };
          this.setEntry(attachmentId, { state: 'failed', item: previous, error: failed, retryCount });
          throw error instanceof Error ? error : new Error(message);
        }
      }
    }

    throw new Error('Image resource failed to load');
  }

  private isExpired(item: ImageItem): boolean {
    if (!item.expiresAt) return false;
    const expiresAt = Date.parse(item.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt - this.expirySafetyMarginMs <= this.now();
  }

  private setEntry(attachmentId: string, entry: CacheEntry): void {
    this.cache.set(attachmentId, entry);
    this.notify(attachmentId);
  }

  private notify(attachmentId: string): void {
    this.listeners.get(attachmentId)?.forEach((listener) => listener());
  }
}

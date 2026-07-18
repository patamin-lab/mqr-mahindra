import Card from '@/components/shared/layout/Card';
import type { ImageItem } from '@/components/shared/image';
import { t } from '@/lib/i18n/server';
import MachineDocumentsGallery from './MachineDocumentsGallery';

/**
 * Machine Digital Passport Documents section. Split Photos from everything
 * else (Registration/Invoices/Warranty/Attachments) by MIME type, since
 * `AttachmentService` does not tag attachments by document category yet
 * (see `docs/architecture/MACHINE_DATA_OWNERSHIP.md`).
 */
export default function MachineDocumentsPanel({ items }: { items: ImageItem[] }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="documents">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.documentsTitle')}</h2>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('machinePassport.documentsPhotos')}</h3>
      <MachineDocumentsGallery
        items={items.filter((item) => item.mimeType.startsWith('image/'))}
        emptyMessage={t('attachmentViewer.noAttachments')}
        unavailableMessage={t('attachmentViewer.unavailable')}
        openLabel={t('attachmentViewer.open')}
        downloadLabel={t('attachmentViewer.download')}
        labels={{
          zoomOut: t('attachmentViewer.zoomOut'),
          zoomIn: t('attachmentViewer.zoomIn'),
          rotate: t('attachmentViewer.rotateRight'),
          reset: t('attachmentViewer.reset'),
          toolbar: t('attachmentViewer.imageControls'),
        }}
        navigationLabels={{
          previous: t('attachmentViewer.previous'),
          next: t('attachmentViewer.next'),
          close: t('attachmentViewer.close'),
        }}
      />

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('machinePassport.documentsOther')}</h3>
      <MachineDocumentsGallery
        items={items.filter((item) => !item.mimeType.startsWith('image/'))}
        emptyMessage={t('attachmentViewer.noAttachments')}
        unavailableMessage={t('attachmentViewer.unavailable')}
        openLabel={t('attachmentViewer.open')}
        downloadLabel={t('attachmentViewer.download')}
        labels={{
          zoomOut: t('attachmentViewer.zoomOut'),
          zoomIn: t('attachmentViewer.zoomIn'),
          rotate: t('attachmentViewer.rotateRight'),
          reset: t('attachmentViewer.reset'),
          toolbar: t('attachmentViewer.imageControls'),
        }}
        navigationLabels={{
          previous: t('attachmentViewer.previous'),
          next: t('attachmentViewer.next'),
          close: t('attachmentViewer.close'),
        }}
      />
    </Card>
  );
}

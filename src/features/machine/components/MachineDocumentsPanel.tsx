import Card from '@/components/shared/layout/Card';
import AttachmentViewer, { AttachmentViewerItem } from '@/components/shared/attachments/AttachmentViewer';
import { t } from '@/lib/i18n/server';

/**
 * Machine Digital Passport - Documents section. Reuses the exact same
 * `AttachmentViewer` + resolved-URL items Machine 360 already renders (no
 * second storage read, ADR-010) - split into Photos vs. everything else
 * (Registration/Invoices/Warranty/Attachments) by MIME type, since
 * `AttachmentService` doesn't tag attachments by document category yet
 * (see `docs/architecture/MACHINE_DATA_OWNERSHIP.md`).
 */
export default function MachineDocumentsPanel({ items }: { items: AttachmentViewerItem[] }) {
  const photos = items.filter((i) => i.mimeType.startsWith('image/'));
  const other = items.filter((i) => !i.mimeType.startsWith('image/'));

  return (
    <Card variant="compact" className="p-6" as="section" id="documents">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.documentsTitle')}</h2>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('machinePassport.documentsPhotos')}</h3>
      <AttachmentViewer items={photos} emptyMessage={t('attachmentViewer.noAttachments')} />

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('machinePassport.documentsOther')}</h3>
      <AttachmentViewer items={other} emptyMessage={t('attachmentViewer.noAttachments')} />
    </Card>
  );
}

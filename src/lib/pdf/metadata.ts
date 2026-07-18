import { APP_NAME } from '../branding';

/**
 * Corporate PDF Standardization: shared document metadata (the file's own
 * Title/Author/Creator/Producer properties, visible in a PDF viewer's
 * "Document Properties" panel - distinct from anything rendered on the
 * page itself). None of the three existing PDF renderers set this today;
 * every one of them now passes the return value straight to react-pdf's
 * `<Document>` props, so a PDF viewer always shows a real title (e.g.
 * "NTR-D1-2026-000001 - Tractor Registration Record") and the same
 * Author/Creator/Producer across every module.
 */
export interface PdfDocumentMeta {
  title: string;
  author: string;
  creator: string;
  producer: string;
  subject: string;
  language: string;
}

export function buildPdfDocumentMeta(title: string, subject: string): PdfDocumentMeta {
  return {
    title,
    subject,
    author: APP_NAME,
    creator: APP_NAME,
    producer: APP_NAME,
    language: 'en',
  };
}

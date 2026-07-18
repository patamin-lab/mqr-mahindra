import React from 'react';
import { Text } from '@react-pdf/renderer';
import { sharedPdfStyles } from './sharedStyles';
import { formatDateTimeLocalized } from '../thaiDate';
import { translate } from '../i18n/translate';
import { PDF_LOCALE } from './locale';
import { APP_NAME, APP_VERSION } from '../branding';

/**
 * Corporate PDF Standardization: shared footer (generation metadata + the
 * document's own canonical URL) - previously three different
 * implementations (NTR's own "Generated At/By/System Version" line, MQR's
 * and PM's lighter "Generated At: <date> - MQR/PM" line, none of which
 * included a system version or, for MQR/PM, who generated it). Every PDF
 * now shows the same three facts in the same place.
 *
 * Deliberately does NOT include a record's own audit trail (created by/
 * updated by, etc.) - that is real per-record business data MQR/PM's PDF
 * already showed above this footer, not generation metadata, and stays
 * exactly where it was, unchanged, in each module's own document body.
 */
export interface PdfFooterProps {
  generatedBy?: string;
  documentUrl: string;
}

export function PdfFooter({ generatedBy, documentUrl }: PdfFooterProps) {
  const generatedAt = formatDateTimeLocalized(new Date(), PDF_LOCALE);
  return (
    <>
      <Text style={sharedPdfStyles.auditText}>
        {APP_NAME} {APP_VERSION} — {translate(PDF_LOCALE, 'ntr.footerGeneratedAt')}: {generatedAt}
        {generatedBy ? ` — ${translate(PDF_LOCALE, 'ntr.footerGeneratedBy')}: ${generatedBy}` : ''}
      </Text>
      <Text style={sharedPdfStyles.footer}>{documentUrl}</Text>
    </>
  );
}

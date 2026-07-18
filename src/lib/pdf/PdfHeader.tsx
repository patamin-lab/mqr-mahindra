import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { PdfBrandLogo } from './PdfBrandLogo';
import { sharedPdfStyles } from './sharedStyles';

/**
 * Corporate PDF Standardization: shared print layout for every document's
 * header block (logo, title, subtitle lines, status badges, QR code) -
 * extracted from the three near-identical copies in exportPdf.tsx (MQR),
 * ntrPdf.tsx (NTR), and maintenancePdf.tsx (PM), which differed only in
 * their actual title/subtitle/badge *content*, never the structure. Each
 * caller keeps full control of its own content (title text, how many
 * subtitle lines, which badges and their colors) - this component only
 * standardizes the layout those pieces sit in, never the business content
 * itself.
 */
export interface PdfHeaderProps {
  title: string;
  subtitleLines: React.ReactNode[];
  badges?: React.ReactNode[];
  /** Omitted for a list/bulk document, which has no single record to link
   *  a QR code to. */
  qrDataUrl?: string;
  qrCaption?: string;
}

export function PdfHeader({ title, subtitleLines, badges, qrDataUrl, qrCaption }: PdfHeaderProps) {
  return (
    <>
      <View style={sharedPdfStyles.headerRow}>
        <View style={{ flex: 1 }}>
          <PdfBrandLogo />
          <Text style={sharedPdfStyles.title}>{title}</Text>
          {subtitleLines.map((line, i) => (
            <Text key={i} style={sharedPdfStyles.subtitle}>
              {line}
            </Text>
          ))}
          {badges && badges.length > 0 && <View style={sharedPdfStyles.badgeRow}>{badges}</View>}
        </View>
        {qrDataUrl && (
          <View>
            <Image src={qrDataUrl} style={sharedPdfStyles.qr} />
            {qrCaption && <Text style={sharedPdfStyles.qrCaption}>{qrCaption}</Text>}
          </View>
        )}
      </View>
      <View style={sharedPdfStyles.titleRule} />
    </>
  );
}

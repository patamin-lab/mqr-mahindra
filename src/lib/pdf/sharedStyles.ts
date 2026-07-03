import { StyleSheet } from '@react-pdf/renderer';
import { PDF_BRAND_RED } from './brand';

/**
 * Shared react-pdf style rules (docs/standards/UI_COMPONENT_STANDARD.md
 * "PDF Header / PDF Footer" consolidation). Extracted from the subset of
 * `exportPdf.tsx` (MQR) and `maintenancePdf.tsx` (PM) style objects that
 * were byte-for-byte identical between the two renderers - confirmed by
 * direct comparison before extraction. Rules that differed even slightly
 * (`section`, `badge`, `infoTable`, `photoBox`/`photo`/`photoPlaceholder`
 * sizes) were deliberately left out and stay defined per-renderer, since
 * merging them would change one module's actual PDF output.
 */
export const sharedPdfStyles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Sarabun', fontSize: 9, color: '#1a1a1a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: 'bold', marginBottom: 2, color: PDF_BRAND_RED },
  titleRule: { borderBottomWidth: 2, borderColor: PDF_BRAND_RED, marginTop: 6, marginBottom: 10 },
  subtitle: { fontSize: 9, color: '#666', marginBottom: 2 },
  qr: { width: 56, height: 56 },
  qrCaption: { fontSize: 6, color: '#999', textAlign: 'center', marginTop: 2, width: 56 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },

  infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e5e5' },
  infoCellLabel: {
    width: '17%',
    backgroundColor: '#f3f3f3',
    padding: 5,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#444',
    borderRightWidth: 1,
    borderColor: '#e5e5e5',
  },
  infoCellValue: { width: '33%', padding: 5, fontSize: 8.5, borderRightWidth: 1, borderColor: '#e5e5e5' },
  infoCellValueLast: { width: '33%', padding: 5, fontSize: 8.5 },
  infoCellValueFull: { width: '83%', padding: 5, fontSize: 8.5 },

  sectionTitle: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: PDF_BRAND_RED },
  paragraph: { fontSize: 9, lineHeight: 1.4 },
  link: { fontSize: 8.5, color: '#1a56db' },

  photoCategoryLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: PDF_BRAND_RED,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 6,
    marginTop: 10,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoLabel: { fontSize: 7, marginTop: 3, textAlign: 'center', color: '#555' },

  auditText: { fontSize: 7, color: '#999' },
  issuedText: { fontSize: 7, color: '#999', marginTop: 2 },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#999', textAlign: 'right' },
});

/**
 * Corporate PDF Standardization: shared filename convention. Every export
 * route (NTR/PM/MQR today) previously copy-pasted the identical sanitize-
 * then-append-extension logic (`replace(/[^a-zA-Z0-9_-]/g, '_')`) - one
 * shared function guarantees they can never drift (e.g. one route
 * forgetting to strip a character `Content-Disposition` can't safely
 * carry). Deliberately preserves each module's existing, already-
 * recognizable filename shape (its own reference number, e.g.
 * `NTR-D1-2026-000001.pdf`) rather than inventing a new naming scheme -
 * that's a presentation-consistency fix, not a new business decision.
 */
export function buildPdfFilename(referenceNumber: string): string {
  const safe = referenceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safe}.pdf`;
}

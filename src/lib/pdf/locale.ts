import { Locale } from '../i18n/types';

/**
 * Corporate PDF Standardization: every production PDF (NTR/PM/MQR today;
 * any future module's PDF) renders in English only, regardless of the
 * viewing user's own UI language preference - a printed/downloaded
 * document is a corporate artifact, not a personalized screen. Every PDF
 * renderer imports this instead of accepting a caller-supplied `locale`,
 * so there is exactly one place that decision is made. The route handlers
 * that generate these PDFs still resolve the visitor's own UI locale
 * separately for their own JSON error messages - that is a different,
 * legitimate use of `Locale` and is untouched by this constant.
 */
export const PDF_LOCALE: Locale = 'en';

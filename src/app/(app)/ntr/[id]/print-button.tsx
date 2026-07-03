'use client';

import { useTranslation } from '@/lib/i18n/LocaleProvider';

/** Mirrors records/[jobId]/print-button.tsx's exact pattern - native
 *  browser print, no client-side PDF re-render. */
export default function NtrPrintButton() {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 print:hidden"
    >
      {t('ntr.printButton')}
    </button>
  );
}

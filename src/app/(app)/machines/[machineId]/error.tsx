'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import EmptyState from '@/components/shared/layout/EmptyState';

/**
 * Machine Passport route-segment Error Boundary (Next.js `error.tsx`
 * convention) - the actual net for "Application error: a server-side
 * exception has occurred" on this page. `<Suspense>` (used throughout
 * `page.tsx`) only defers loading; it never caught a thrown error, so
 * before this file existed, any single unhandled rejection anywhere in
 * the Machine Passport's data-fetch tree took down the whole page with no
 * fallback (see the section components' own defensive-programming fixes
 * for the underlying data-fetch hardening this boundary backs up).
 */
export default function MachinePassportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error('Machine Passport render error', error);
  }, [error]);

  return (
    <div className="space-y-4">
      <EmptyState
        icon="⚠️"
        title={t('common.pageErrorTitle')}
        reason={t('common.pageErrorReason')}
        nextStep={t('common.pageErrorNextStep')}
        action={
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => reset()} className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark">
              {t('common.tryAgain')}
            </button>
            <Link href="/machines" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('machinePassport.searchAgain')}
            </Link>
          </div>
        }
      />
    </div>
  );
}

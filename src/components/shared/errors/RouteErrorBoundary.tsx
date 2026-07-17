'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import EmptyState from '@/components/shared/layout/EmptyState';

/**
 * Shared route-segment Error Boundary body (Next.js `error.tsx`
 * convention) - the actual net for "Application error: a server-side
 * exception has occurred". `<Suspense>` only defers loading; it never
 * catches a thrown error, so any route with no `error.tsx` of its own
 * takes down the whole page (falling through to the app's root
 * `global-error.tsx`, which replaces the entire app shell/sidebar - a much
 * worse degradation than staying inside this page's own layout).
 *
 * Originally written once for Machine Passport (Bug 5); extracted here so
 * every other route that reads a single record server-side (NTR, MQR, PM)
 * gets the same net via a two-line `error.tsx` instead of a fifth copy of
 * this markup.
 */
export default function RouteErrorBoundary({
  error,
  reset,
  backHref,
  backLabel,
  logLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  backHref: string;
  backLabel: string;
  logLabel: string;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error(`${logLabel} render error`, error);
  }, [error, logLabel]);

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
            <Link href={backHref} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {backLabel}
            </Link>
          </div>
        }
      />
    </div>
  );
}

'use client';

import { useTranslation } from '@/lib/i18n/LocaleProvider';
import RouteErrorBoundary from '@/components/shared/errors/RouteErrorBoundary';

/** PM detail route-segment Error Boundary - see `RouteErrorBoundary`.
 *  The page's own `getById()` call already has a try/catch fallback
 *  (Bug 1 fix); this is the net for anything that throws outside that
 *  block (e.g. during render). */
export default function PmDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation();
  return <RouteErrorBoundary error={error} reset={reset} backHref="/pm-records" backLabel={t('common.back')} logLabel="PM record detail" />;
}

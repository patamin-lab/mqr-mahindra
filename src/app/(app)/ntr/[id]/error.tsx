'use client';

import { useTranslation } from '@/lib/i18n/LocaleProvider';
import RouteErrorBoundary from '@/components/shared/errors/RouteErrorBoundary';

/** NTR detail route-segment Error Boundary - see `RouteErrorBoundary`. */
export default function NtrDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation();
  return <RouteErrorBoundary error={error} reset={reset} backHref="/ntr" backLabel={t('common.back')} logLabel="NTR detail" />;
}

'use client';

import { useTranslation } from '@/lib/i18n/LocaleProvider';
import RouteErrorBoundary from '@/components/shared/errors/RouteErrorBoundary';

/** MQR (Quality Report) detail route-segment Error Boundary - see `RouteErrorBoundary`. */
export default function RecordDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation();
  return <RouteErrorBoundary error={error} reset={reset} backHref="/records" backLabel={t('common.back')} logLabel="MQR record detail" />;
}

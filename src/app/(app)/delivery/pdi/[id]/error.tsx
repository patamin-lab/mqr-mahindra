'use client';

import { useTranslation } from '@/lib/i18n/LocaleProvider';
import RouteErrorBoundary from '@/components/shared/errors/RouteErrorBoundary';

/** Import Inspection (PDI) detail route-segment Error Boundary - see `RouteErrorBoundary`. */
export default function PdiDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation();
  return <RouteErrorBoundary error={error} reset={reset} backHref="/delivery/pdi" backLabel={t('common.back')} logLabel="Import Inspection detail" />;
}

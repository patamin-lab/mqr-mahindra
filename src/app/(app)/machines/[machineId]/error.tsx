'use client';

import { useTranslation } from '@/lib/i18n/LocaleProvider';
import RouteErrorBoundary from '@/components/shared/errors/RouteErrorBoundary';

/**
 * Machine Passport route-segment Error Boundary - see
 * `RouteErrorBoundary`'s own doc comment for why this exists (the section
 * components' own defensive-programming fixes handle the underlying
 * data-fetch hardening; this is the last-resort net behind them).
 */
export default function MachinePassportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation();
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      backHref="/machines"
      backLabel={t('machinePassport.searchAgain')}
      logLabel="Machine Passport"
    />
  );
}

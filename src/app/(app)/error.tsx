'use client';

import { useTranslation } from '@/lib/i18n/LocaleProvider';
import RouteErrorBoundary from '@/components/shared/errors/RouteErrorBoundary';

/**
 * App-shell-wide Error Boundary (Next.js `error.tsx` convention, placed at
 * the `(app)` route group root, sibling to `layout.tsx`). Renders inside
 * the authenticated shell (sidebar/nav stay visible - only the page
 * content area is replaced), covering every route under `(app)/` that has
 * no more specific `error.tsx` of its own.
 *
 * UAT audit (2026-07-18) found only 5 of ~16 detail/list/create routes
 * under `(app)/` had any boundary at all (Machine Passport, NTR detail,
 * MQR detail, PM detail, PDI detail) - everything else (quality dashboard,
 * admin lists, delivery records detail, knowledge case detail, PDI
 * dashboard, every `/new` create page) fell all the way through to the
 * root `global-error.tsx`, which replaces the entire `<html>/<body>` and
 * drops the sidebar - a much worse degradation than staying inside the
 * app shell. One boundary here closes every one of those gaps at once,
 * and covers any future route added under `(app)/` too, rather than
 * requiring a matching per-route file each time. The five existing
 * route-specific `error.tsx` files are unaffected - Next.js always prefers
 * the more specific boundary for its own subtree - and keep their nicer
 * contextual "back to this list" link instead of this generic one.
 */
export default function AppShellError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation();
  return <RouteErrorBoundary error={error} reset={reset} backHref="/dashboard" backLabel={t('common.backToDashboard')} logLabel="App" />;
}

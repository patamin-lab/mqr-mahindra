import StatusPill from '@/components/shared/status/StatusPill';
import type { KnowledgeMaturity } from '../types';

/**
 * Composes the platform's one generic `StatusPill` (never `StatusBadge`,
 * the admin active/inactive-specific variant) with Knowledge's own
 * maturity color map — matching the existing per-domain-color-map,
 * shared-shape pattern `records/page.tsx`'s `statusColor` already uses.
 *
 * Takes an already-translated `label`, not a `t()` call inside this
 * component — this file has no "server" or "client" affinity of its own
 * (`StatusPill` itself doesn't either) and is rendered from both a Server
 * Component (the list/detail pages, using `@/lib/i18n/server`'s `t()`)
 * and a Client Component (`KnowledgeMaturityControl`, using
 * `useTranslation()`); importing the server-only `t()` here would make
 * this component illegal to import from a Client Component.
 */
const MATURITY_COLOR: Record<KnowledgeMaturity, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Review: 'bg-amber-100 text-amber-700',
  Published: 'bg-green-100 text-green-700',
  Deprecated: 'bg-orange-100 text-orange-700',
  Archived: 'bg-gray-200 text-gray-700',
};

export default function MaturityPill({ maturity, label }: { maturity: KnowledgeMaturity; label: string }) {
  return <StatusPill colorClassName={MATURITY_COLOR[maturity]}>{label}</StatusPill>;
}

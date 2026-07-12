import { ReactNode } from 'react';

/**
 * Page/section-level Empty State (MSEAL Design Framework, ADR-023,
 * EMPTY_STATE_GUIDELINE.md). Distinct from
 * `components/shared/admin/EmptyState.tsx`, which renders one `<tr>` inside
 * an existing table and is not reused here - this is a full-width block for
 * a dashboard widget, a list page, or any section that isn't a table row.
 *
 * The Guideline's rule: never show "No Data" alone. `reason` (why it's
 * empty) and `nextStep` (what the user should do) are both required props,
 * not optional decoration - a caller that has nothing to say for either one
 * should reconsider whether this is really an empty state or a Coming Soon
 * placeholder (see `comingSoon` below).
 */
export interface EmptyStateProps {
  icon?: string;
  title: string;
  reason: string;
  nextStep: string;
  action?: ReactNode;
  /** Renders a "Coming Soon" tone (dashed border, muted) instead of the
   *  normal empty-state tone - for a widget whose data source doesn't
   *  exist yet (no module/table/query), as opposed to a real feature with
   *  a real query that simply returned zero rows today. */
  comingSoon?: boolean;
}

export default function EmptyState({ icon = '📭', title, reason, nextStep, action, comingSoon }: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl p-6 text-center ${
        comingSoon ? 'border border-dashed border-gray-300 bg-gray-50' : 'border border-gray-100 bg-white'
      }`}
    >
      <div className="text-2xl mb-2" aria-hidden="true">{icon}</div>
      <div className="font-semibold text-brand-dark text-sm">{title}</div>
      <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">{reason}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">{nextStep}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

import { ReactNode } from 'react';

/**
 * Shared page/detail-page header shell (docs/standards/UI_COMPONENT_STANDARD.md
 * "Page Header" consolidation). Extracted verbatim from the near-identical
 * markup that was duplicated across records/page.tsx, records/[jobId]/page.tsx,
 * pm-records/[id]/page.tsx, pm-records/[id]/edit/page.tsx,
 * vehicles/page.tsx, vehicles/[serial]/page.tsx, and dashboard/page.tsx -
 * every prop below maps to something one of those pages already did
 * inline, so a caller passing the same values it used before renders
 * pixel-identical output. No new layout shapes were invented.
 */
export interface PageHeaderProps {
  /** Main heading content (usually a string, but a ReactNode so callers
   *  that interpolate a job number etc. keep working unchanged). */
  title: ReactNode;
  /** Overrides the default `<h1>` className - pages differ on text-xl vs
   *  text-2xl today; pass the page's existing class to preserve it. */
  titleClassName?: string;
  /** Rendered inline next to the title inside the same row (e.g. a status
   *  badge) - only pm-records/[id]/page.tsx and records/[jobId]/page.tsx
   *  use this today. */
  titleAdornments?: ReactNode;
  /** Rendered above the title block (records/[jobId]/page.tsx's "back to
   *  list" link, which sits above the title there instead of beside it). */
  backLink?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned action button cluster. Omit entirely for header shapes
   *  with no actions (dashboard, the vehicles index page). */
  actions?: ReactNode;
  /** Overrides the outer wrapper className - the flex layout differs
   *  slightly per page (stacks on mobile vs. always-row, gap-3 vs gap-4,
   *  flex-wrap vs not), so this always defaults to the shape used by the
   *  majority of detail pages but every caller should pass its own. */
  className?: string;
  actionsClassName?: string;
}

const DEFAULT_WRAPPER = 'flex items-center justify-between gap-4';
const DEFAULT_ACTIONS = 'flex items-center gap-2';
const DEFAULT_TITLE = 'text-xl font-bold text-brand-dark';

export default function PageHeader({
  title,
  titleClassName,
  titleAdornments,
  backLink,
  subtitle,
  actions,
  className,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <div className={className ?? DEFAULT_WRAPPER}>
      <div>
        {backLink}
        {titleAdornments ? (
          <div className={`flex items-center gap-3${backLink ? ' mt-1' : ''}`}>
            <h1 className={titleClassName ?? DEFAULT_TITLE}>{title}</h1>
            {titleAdornments}
          </div>
        ) : (
          <h1 className={titleClassName ?? DEFAULT_TITLE}>{title}</h1>
        )}
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className={actionsClassName ?? DEFAULT_ACTIONS}>{actions}</div>}
    </div>
  );
}

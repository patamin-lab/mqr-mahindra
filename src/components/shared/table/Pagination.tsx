import Link from 'next/link';

/**
 * Platform Pagination (Phase 2 list-page standardization) - generalized
 * from `records/page.tsx`'s own prev/next implementation (the only one of
 * the report pages with correct disabled-state styling), so NTR/PM/PDI
 * stop hand-rolling their own slightly-different version.
 *
 * Two modes, same markup: URL-driven (`buildHref`, the App Router pattern
 * Records/NTR/PDI already use for filters - a real `<Link>` per page) or
 * callback-driven (`onPageChange`, for a client-paginated table like PM's
 * `MaintenanceHistory`, which keeps `pageIndex` as local
 * `@tanstack/react-table` state rather than a URL param - a real
 * architectural difference, not one to force into a Link). Exactly one of
 * the two must be given.
 */
export interface PaginationLabels {
  previous: string;
  next: string;
  pageOf: string;
  /** Omit to hide the "showing X-Y of Z" line entirely (some pages, e.g.
   *  NTR's original pager, only ever showed page/prev/next). */
  showing?: string;
}

const DEFAULT_LABELS: Required<Pick<PaginationLabels, 'previous' | 'next' | 'pageOf'>> = {
  previous: 'Previous',
  next: 'Next',
  pageOf: 'Page {page} / {totalPages}',
};

function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

interface PaginationBaseProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  labels?: Partial<PaginationLabels>;
}

export type PaginationProps = PaginationBaseProps & ({ buildHref: (page: number) => string; onPageChange?: never } | { onPageChange: (page: number) => void; buildHref?: never });

export default function Pagination({ page, totalPages, total, pageSize, buildHref, onPageChange, labels }: PaginationProps) {
  if (total === 0) return null;
  const l = { ...DEFAULT_LABELS, ...labels };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const nav = (targetPage: number, label: string, disabled: boolean) => {
    const className = disabled
      ? 'cursor-not-allowed rounded border border-gray-200 px-3 py-1.5 text-gray-300'
      : 'rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-50';
    if (disabled) return <span className={className}>{label}</span>;
    if (buildHref) {
      return (
        <Link href={buildHref(targetPage)} className={className}>
          {label}
        </Link>
      );
    }
    return (
      <button type="button" className={className} onClick={() => onPageChange?.(targetPage)}>
        {label}
      </button>
    );
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
      <div>{l.showing ? format(l.showing, { from, to, total }) : null}</div>
      <div className="flex items-center gap-2">
        {nav(page - 1, l.previous, page <= 1)}
        <span>{format(l.pageOf, { page, totalPages })}</span>
        {nav(page + 1, l.next, page >= totalPages)}
      </div>
    </div>
  );
}

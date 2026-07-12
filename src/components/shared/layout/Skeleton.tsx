/**
 * Generic block-level loading skeleton (MSEAL Design Framework, ADR-023,
 * "Prefer Skeleton Loading. Avoid full-page spinners."). Distinct from
 * `components/shared/admin/LoadingState.tsx`, which renders `<tr>` rows
 * inside an existing table - this is a plain block for cards/widgets
 * outside a table (a KPI card, a chart card, a dashboard section) while
 * its real data is loading.
 */
export interface SkeletonProps {
  /** Number of shimmer lines to render (a KPI card needs 1-2, a chart
   *  card's placeholder body needs more). */
  lines?: number;
  className?: string;
}

export default function Skeleton({ lines = 1, className }: SkeletonProps) {
  return (
    <div className={`animate-pulse space-y-2 ${className ?? ''}`} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3.5 rounded bg-gray-200" style={{ width: i === 0 ? '60%' : '90%' }} />
      ))}
    </div>
  );
}

import { ReactNode } from 'react';
import Card from '@/components/shared/layout/Card';

/**
 * Chart Card (MSEAL Design Framework, ADR-023, Widget Standard /
 * CHART_GUIDELINE.md). Every chart on the platform answers a named
 * decision - `decision` is required, not optional, so a caller can't wrap
 * a chart in this card without first stating what it's for. If there's
 * no real answer to "what decision does this support," the Chart
 * Guideline's instruction is to remove the chart, not reach for this card.
 */
export interface ChartCardProps {
  title: string;
  /** One short sentence: the decision this chart supports. Shown as the
   *  card's subtitle, in the same slot `Panel`'s `note` prop already uses
   *  on `/quality/dashboard` - this is that same pattern, promoted to a
   *  named, reusable component instead of a page-local one. */
  decision: string;
  action?: ReactNode;
  children: ReactNode;
}

export default function ChartCard({ title, decision, action, children }: ChartCardProps) {
  return (
    <Card variant="flat" className="p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-semibold text-brand-dark">{title}</h2>
        {action}
      </div>
      <p className="text-xs text-gray-400 mb-2">{decision}</p>
      {children}
    </Card>
  );
}

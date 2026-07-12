import Card from '@/components/shared/layout/Card';

/**
 * Progress Card (MSEAL Design Framework, ADR-023, Widget Standard). A
 * single labeled progress bar - import batch progress, PM program
 * completion, campaign rollout, etc. `value` is a 0-100 percentage;
 * callers compute their own domain-specific percentage rather than this
 * component guessing at one.
 */
export interface ProgressCardProps {
  label: string;
  value: number;
  sub?: string;
}

export default function ProgressCard({ label, value, sub }: ProgressCardProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <Card variant="flat" className="p-5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-brand-dark">{Math.round(pct)}%</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${pct}%` }} />
      </div>
      {sub && <div className="text-xs text-gray-400 mt-1.5">{sub}</div>}
    </Card>
  );
}

import Card from '@/components/shared/layout/Card';

/**
 * The ONE shared KPI card - a labeled number in a `Card`, optional accent
 * color and sub-label. Extracted from `dashboard/page.tsx`'s previously
 * local, unexported `KpiCard` function per
 * `docs/standards/UI_COMPONENT_STANDARD.md`'s "KPI Cards" consolidation
 * recommendation - same markup, same visual result, now reusable by any
 * future module's summary/stat row instead of a second hand-rolled copy.
 */
export interface KpiCardProps {
  label: string;
  value: number | string;
  accent?: string;
  sub?: string;
}

export default function KpiCard({ label, value, accent, sub }: KpiCardProps) {
  return (
    <Card variant="flat" className="p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${accent ?? 'text-brand-dark'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </Card>
  );
}

import Card from '@/components/shared/layout/Card';
import StatusPill from '@/components/shared/status/StatusPill';

/**
 * Health Card (MSEAL Design Framework, ADR-023, Widget Standard). One
 * system/integration's health at a glance - status pill (reusing the
 * platform's one `StatusPill` renderer, not a new color system), a short
 * detail line, and when it was last checked. First real consumer: the
 * Platform Overview's System Health widget, backed by the existing
 * Tractor-IN sync health check (`getTractorInSyncHealth()`) - no new
 * health-check logic invented here, just a standard way to display one.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

const STATUS_STYLE: Record<HealthStatus, { colorClassName: string; label: string }> = {
  healthy: { colorClassName: 'bg-green-100 text-green-700', label: 'Healthy' },
  degraded: { colorClassName: 'bg-amber-100 text-amber-700', label: 'Degraded' },
  down: { colorClassName: 'bg-red-100 text-red-700', label: 'Down' },
  unknown: { colorClassName: 'bg-gray-100 text-gray-500', label: 'Unknown' },
};

export interface HealthCardProps {
  label: string;
  status: HealthStatus;
  statusLabel?: string;
  detail?: string;
  lastCheckedAt?: string | null;
}

export default function HealthCard({ label, status, statusLabel, detail, lastCheckedAt }: HealthCardProps) {
  const style = STATUS_STYLE[status];
  return (
    <Card variant="flat" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-500">{label}</div>
        <StatusPill colorClassName={style.colorClassName}>{statusLabel ?? style.label}</StatusPill>
      </div>
      {detail && <div className="text-sm text-brand-dark mt-2">{detail}</div>}
      {lastCheckedAt && <div className="text-xs text-gray-400 mt-1">Last checked: {lastCheckedAt}</div>}
    </Card>
  );
}

import Card from '@/components/shared/layout/Card';
import StatusPill from '@/components/shared/status/StatusPill';
import { t } from '@/lib/i18n/server';

/**
 * Health Card (MSEAL Design Framework, ADR-023, Widget Standard). One
 * system/integration's health at a glance - status pill (reusing the
 * platform's one `StatusPill` renderer, not a new color system), a short
 * detail line, and when it was last checked. First real consumer: the
 * Platform Overview's System Health widget, backed by the existing
 * Tractor-IN sync health check (`getTractorInSyncHealth()`) - no new
 * health-check logic invented here, just a standard way to display one.
 *
 * No `'use client'` directive - every current caller renders this from a
 * Server Component tree (`dashboard/page.tsx`, `MachineHealthPanel.tsx`),
 * so it reads the request locale directly via `t()` from
 * `@/lib/i18n/server` for its own fallback strings, rather than requiring
 * every caller to translate `statusLabel`/the "last checked" prefix itself.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

const STATUS_KEY: Record<HealthStatus, string> = {
  healthy: 'healthCard.statusHealthy',
  degraded: 'healthCard.statusDegraded',
  down: 'healthCard.statusDown',
  unknown: 'healthCard.statusUnknown',
};

const STATUS_COLOR: Record<HealthStatus, string> = {
  healthy: 'bg-green-100 text-green-700',
  degraded: 'bg-amber-100 text-amber-700',
  down: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-500',
};

export interface HealthCardProps {
  label: string;
  status: HealthStatus;
  statusLabel?: string;
  detail?: string;
  lastCheckedAt?: string | null;
}

export default function HealthCard({ label, status, statusLabel, detail, lastCheckedAt }: HealthCardProps) {
  return (
    <Card variant="flat" className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-500">{label}</div>
        <StatusPill colorClassName={STATUS_COLOR[status]}>{statusLabel ?? t(STATUS_KEY[status])}</StatusPill>
      </div>
      {detail && <div className="text-sm text-brand-dark mt-2">{detail}</div>}
      {lastCheckedAt && <div className="text-xs text-gray-400 mt-1">{t('healthCard.lastChecked', { time: lastCheckedAt })}</div>}
    </Card>
  );
}

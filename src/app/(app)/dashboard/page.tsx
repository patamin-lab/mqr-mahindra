import { getSession } from '@/lib/auth';
import { countVehiclesForSession, countOpenQualityCases, getTractorInSyncHealth, listTodaysAuditLog } from '@/lib/db';
import { seesAllDealers } from '@/lib/scope';
import { formatThaiDateTime } from '@/lib/thaiDate';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import KpiCard from '@/components/shared/dashboard/KpiCard';
import QuickActionCard from '@/components/shared/dashboard/QuickActionCard';
import HealthCard, { HealthStatus } from '@/components/shared/dashboard/HealthCard';
import { mapMixedAuditLogToActivityEvents } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';
import DashboardActivityTimelineSection from './activity-timeline-section';
import Link from 'next/link';

/**
 * Platform Overview (MSEAL Design Framework, ADR-023, Dashboard Standard).
 * This route used to be MQR's own analytics dashboard - that page (charts,
 * filters, leaderboards) still exists unchanged, moved to
 * `/quality/dashboard` as the Quality domain's dashboard. `/dashboard` is
 * now platform-wide: a small number of real, role-aware KPIs plus Quick
 * Actions, not a second copy of MQR's statistics.
 *
 * Dashboard Philosophy: a dashboard is a decision center, not a statistics
 * page - every widget here either answers "what should I do next" (Quick
 * Actions) or is a real number backed by a real query.
 *
 * Production Pilot (2026-07-15): the "Reserved for domains with no real
 * data source yet" Coming Soon section (Active Warranty/Open PM/Service
 * Campaign `EmptyState` tiles) was removed - it contradicted this
 * platform's own Production Pilot policy, already applied to the sidebar
 * nav in PR #60 ("Production Pilot exposes only completed workflows...
 * an unfinished capability is hidden completely, never shown disabled").
 * Showing three permanently-disabled tiles to every role, including
 * SuperAdmin, on the single most-visited page was the one place that
 * policy wasn't actually applied. The underlying gap (no Warranty/PM-due/
 * Service Campaign data source exists yet) is unchanged and still
 * tracked in `docs/architecture/MSEAL_DESIGN_FRAMEWORK.md`'s Gap
 * Analysis - only the always-visible placeholder was removed.
 *
 * "Today's Activities" (ADR-023 refinement) reuses the same
 * `<ActivityTimeline>` platform standard every module's own record detail
 * page already uses - no second timeline component - fed by
 * `listTodaysAuditLog()` + `mapMixedAuditLogToActivityEvents()` (see
 * `lib/db.ts`/`activity-timeline/mapAuditLogToActivityEvents.ts`).
 * Deliberately gated to `seesAllDealers` roles only, same as System Health
 * below: `record_audit_log` carries no dealer/branch column of its own, so
 * a platform-wide feed cannot be safely scoped to a DealerAdmin/DealerUser's
 * own dealer without an additional join this pass doesn't build - shown
 * only to roles that already see platform-wide data everywhere else on this
 * page, never unscoped-leaked to a role that shouldn't see it.
 *
 * Historical NTR Import (formerly Legacy Import) retirement (2026-07-16,
 * Product Owner decision, ADR-038): this page's "Pending Imports" KPI and
 * "Legacy Import" Quick Action - the platform's one entry point into that
 * capability - are removed. Nothing else on this page changes.
 *
 * Zero-Compromise UI Review (2026-07-16): four "no dead-end card"/"reduce
 * clicks" fixes - (1) both widget rows now grid to their real, fixed item
 * count (`lg:grid-cols-3` - Primary KPIs never exceeds 3, Quick Actions is
 * exactly 3) instead of `lg:grid-cols-4`, which always left an empty
 * trailing cell on desktop; (2) "Open Quality Cases" now links straight to
 * the filtered record list (`/records?status=open`, new pseudo-status
 * supported by `listRecords()`/`listRecordsPaginated()` - see `lib/db.ts`)
 * instead of the Quality domain dashboard - one click to the actual list
 * the number describes, not two; (3) the "Quality Cases" Quick Action's own
 * description already promised "review open cases" but its `href` opened
 * the unfiltered list - now matches its own description, same
 * `/records?status=open` destination as (2); (4) "Today's Activities" rows
 * now link to the record each event is actually about via
 * `getActivityEntityHref()` - previously a dead end, since the cross-module
 * feed had no page of its own to scroll to.
 */
export default async function PlatformOverviewPage() {
  const session = await getSession();
  if (!session) return null;

  const canSeeSystemHealth = seesAllDealers(session.role);
  const canSeeTodaysActivities = seesAllDealers(session.role);

  // Promise.allSettled, not Promise.all: these widgets are independent and
  // each already renders its own "no data" fallback - one query failing
  // (e.g. a transient DB error) must never take down the others.
  const [registeredMachinesResult, openQualityCasesResult, syncHealthResult, todaysAuditLogResult] =
    await Promise.allSettled([
      countVehiclesForSession(session),
      countOpenQualityCases(session),
      canSeeSystemHealth ? getTractorInSyncHealth() : Promise.resolve(null),
      canSeeTodaysActivities ? listTodaysAuditLog() : Promise.resolve(null),
    ]);

  const registeredMachines = registeredMachinesResult.status === 'fulfilled' ? registeredMachinesResult.value : 0;
  const openQualityCases = openQualityCasesResult.status === 'fulfilled' ? openQualityCasesResult.value : 0;
  const syncHealth = syncHealthResult.status === 'fulfilled' ? syncHealthResult.value : null;
  const todaysAuditLog = todaysAuditLogResult.status === 'fulfilled' ? todaysAuditLogResult.value : null;

  const syncStatus: HealthStatus =
    syncHealth?.syncStatus === 'success' ? 'healthy' : syncHealth?.syncStatus === 'partial_failure' ? 'degraded' : 'unknown';
  const todaysActivityEvents = todaysAuditLog ? mapMixedAuditLogToActivityEvents(todaysAuditLog) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('dashboard.title')}
        titleClassName="text-2xl font-bold text-brand-dark"
        subtitle={t('dashboard.subtitle')}
        className="block"
      />

      {/* ---------- Primary KPIs (real, role-aware) ---------- */}
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-3">{t('dashboard.platformKpis')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            label={t('dashboard.registeredMachines')}
            value={registeredMachines}
            action={<Link href="/machines" className="text-brand-red hover:underline">{t('dashboard.viewMachineRegistry')} →</Link>}
          />
          <KpiCard
            label={t('dashboard.openQualityCases')}
            value={openQualityCases}
            accent={openQualityCases > 0 ? 'text-brand-red' : 'text-brand-dark'}
            action={<Link href="/records?status=open" className="text-brand-red hover:underline">{t('dashboard.viewOpenQualityCases')} →</Link>}
          />
          {canSeeSystemHealth && syncHealth && (
            <HealthCard
              label={t('dashboard.systemHealth')}
              status={syncStatus}
              statusLabel={syncHealth.syncStatus === 'never_run' ? t('dashboard.neverRun') : undefined}
              detail={t('dashboard.machinesSynced', { count: syncHealth.totalVehicles.toLocaleString() })}
              lastCheckedAt={syncHealth.lastSyncTime ? formatThaiDateTime(syncHealth.lastSyncTime) : undefined}
            />
          )}
        </div>
      </div>

      {/* ---------- Quick Actions ---------- */}
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-3">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard icon="📝" label={t('dashboard.registerNewTractor')} description={t('dashboard.startNewTractorRegistration')} href="/ntr" />
          <QuickActionCard icon="🚜" label={t('dashboard.machineRegistry')} description={t('dashboard.searchMachinesBySerialModel')} href="/machines" />
          <QuickActionCard icon="⚠️" label={t('dashboard.qualityCasesAction')} description={t('dashboard.reviewOpenQualityCases')} href="/records?status=open" />
        </div>
      </div>

      {/* ---------- Today's Activities (real, reuses ActivityTimeline) ---------- */}
      {canSeeTodaysActivities && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-3">{t('dashboard.todaysActivities')}</h2>
          <Card variant="flat" className="p-5">
            <DashboardActivityTimelineSection events={todaysActivityEvents} />
          </Card>
        </div>
      )}
    </div>
  );
}

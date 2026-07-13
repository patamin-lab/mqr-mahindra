import { getSession } from '@/lib/auth';
import { countVehiclesForSession, countOpenQualityCases, getTractorInSyncHealth, listTodaysAuditLog } from '@/lib/db';
import { createNtrImportService } from '@/features/ntr/factory';
import { canManageLegacyImport, seesAllDealers } from '@/lib/scope';
import { formatThaiDateTime } from '@/lib/thaiDate';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import KpiCard from '@/components/shared/dashboard/KpiCard';
import QuickActionCard from '@/components/shared/dashboard/QuickActionCard';
import HealthCard, { HealthStatus } from '@/components/shared/dashboard/HealthCard';
import EmptyState from '@/components/shared/layout/EmptyState';
import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import { mapMixedAuditLogToActivityEvents } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';
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
 * Actions) or is a real number backed by a real query. Widgets with no real
 * data source yet (Active Warranty, Open PM, Service Campaigns - PIP lives
 * under Engineering Intelligence, see `navConfig.ts` - none of Warranty/
 * PM-due aggregation/Service Campaign exist as queryable data today, see
 * `docs/architecture/MSEAL_DESIGN_FRAMEWORK.md`'s Gap Analysis) render as a
 * named, explained Coming Soon `EmptyState` rather than a fabricated "0" or
 * a silent omission. Recall itself was removed as a nav/dashboard concept
 * entirely (UI Terminology & Navigation Cleanup) - no Recall module/data
 * exists and it had no distinct destination from Service Campaigns.
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
 */
export default async function PlatformOverviewPage() {
  const session = await getSession();
  if (!session) return null;

  const canSeeImports = canManageLegacyImport(session.role);
  const canSeeSystemHealth = seesAllDealers(session.role);
  const canSeeTodaysActivities = seesAllDealers(session.role);

  // Promise.allSettled, not Promise.all: these five widgets are independent
  // and each already renders its own "no data" fallback - one query failing
  // (e.g. a transient DB error) must never take down the other four.
  const [registeredMachinesResult, openQualityCasesResult, pendingImportsResult, syncHealthResult, todaysAuditLogResult] =
    await Promise.allSettled([
      countVehiclesForSession(session),
      countOpenQualityCases(session),
      canSeeImports ? createNtrImportService().listSessions().then((rows) => rows.filter((r) => r.status === 'Pending').length) : Promise.resolve(null),
      canSeeSystemHealth ? getTractorInSyncHealth() : Promise.resolve(null),
      canSeeTodaysActivities ? listTodaysAuditLog() : Promise.resolve(null),
    ]);

  const registeredMachines = registeredMachinesResult.status === 'fulfilled' ? registeredMachinesResult.value : 0;
  const openQualityCases = openQualityCasesResult.status === 'fulfilled' ? openQualityCasesResult.value : 0;
  const pendingImports = pendingImportsResult.status === 'fulfilled' ? pendingImportsResult.value : null;
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label={t('dashboard.registeredMachines')}
            value={registeredMachines}
            action={<Link href="/vehicles" className="text-brand-red hover:underline">{t('dashboard.viewMachineRegistry')} →</Link>}
          />
          <KpiCard
            label={t('dashboard.openQualityCases')}
            value={openQualityCases}
            accent={openQualityCases > 0 ? 'text-brand-red' : 'text-brand-dark'}
            action={<Link href="/quality/dashboard" className="text-brand-red hover:underline">{t('dashboard.viewQualityDashboard')} →</Link>}
          />
          {canSeeImports && (
            <KpiCard
              label={t('dashboard.pendingImports')}
              value={pendingImports ?? 0}
              action={<Link href="/admin/import-history" className="text-brand-red hover:underline">{t('dashboard.viewImportHistory')} →</Link>}
            />
          )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard icon="📝" label={t('dashboard.registerNewTractor')} description={t('dashboard.startNewTractorRegistration')} href="/ntr" />
          <QuickActionCard icon="🚜" label={t('dashboard.machineRegistry')} description={t('dashboard.searchMachinesBySerialModel')} href="/vehicles" />
          <QuickActionCard icon="⚠️" label={t('dashboard.qualityCasesAction')} description={t('dashboard.reviewOpenQualityCases')} href="/records" />
          {canSeeImports && (
            <QuickActionCard icon="📥" label={t('dashboard.legacyImport')} description={t('dashboard.importHistoricalNtrData')} href="/admin/legacy-import" />
          )}
        </div>
      </div>

      {/* ---------- Today's Activities (real, reuses ActivityTimeline) ---------- */}
      {canSeeTodaysActivities && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-3">{t('dashboard.todaysActivities')}</h2>
          <Card variant="flat" className="p-5">
            <ActivityTimeline events={todaysActivityEvents} entityLabel="Record" />
          </Card>
        </div>
      )}

      {/* ---------- Reserved for domains with no real data source yet ---------- */}
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-3">{t('dashboard.comingSoonTitle')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <EmptyState
            icon="🛡️"
            title={t('dashboard.activeWarrantyTitle')}
            reason={t('dashboard.activeWarrantyReason')}
            nextStep={t('dashboard.activeWarrantyNextStep')}
            comingSoon
          />
          <EmptyState
            icon="🔧"
            title={t('dashboard.openPmTitle')}
            reason={t('dashboard.openPmReason')}
            nextStep={t('dashboard.openPmNextStep')}
            comingSoon
          />
          <EmptyState
            icon="📢"
            title={t('dashboard.serviceCampaignsTitle')}
            reason={t('dashboard.serviceCampaignsReason')}
            nextStep={t('dashboard.serviceCampaignsNextStep')}
            comingSoon
          />
        </div>
      </div>
    </div>
  );
}

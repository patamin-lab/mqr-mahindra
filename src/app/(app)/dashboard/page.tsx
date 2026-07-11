import { getSession } from '@/lib/auth';
import { countVehiclesForSession, countOpenQualityCases, getTractorInSyncHealth, listTodaysAuditLog } from '@/lib/db';
import { createNtrImportService } from '@/features/ntr/factory';
import { canManageLegacyImport, seesAllDealers } from '@/lib/scope';
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
 * data source yet (Active Warranty, Open PM, Recall/Service Campaigns -
 * PIP now lives under Engineering Intelligence, see `navConfig.ts` - none of
 * Warranty/PM-due aggregation/Recall exist as queryable data today, see
 * `docs/architecture/MSEAL_DESIGN_FRAMEWORK.md`'s Gap Analysis) render as a
 * named, explained Coming Soon `EmptyState` rather than a fabricated "0" or
 * a silent omission.
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

  const [registeredMachines, openQualityCases, pendingImports, syncHealth, todaysAuditLog] = await Promise.all([
    countVehiclesForSession(session),
    countOpenQualityCases(session),
    canSeeImports ? createNtrImportService().listSessions().then((rows) => rows.filter((r) => r.status === 'Pending').length) : Promise.resolve(null),
    canSeeSystemHealth ? getTractorInSyncHealth() : Promise.resolve(null),
    canSeeTodaysActivities ? listTodaysAuditLog() : Promise.resolve(null),
  ]);

  const syncStatus: HealthStatus =
    syncHealth?.syncStatus === 'success' ? 'healthy' : syncHealth?.syncStatus === 'partial_failure' ? 'degraded' : 'unknown';
  const todaysActivityEvents = todaysAuditLog ? mapMixedAuditLogToActivityEvents(todaysAuditLog) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Overview"
        titleClassName="text-2xl font-bold text-brand-dark"
        subtitle="MSEAL DMS platform-wide status - registered machines, open work, and what needs attention next."
        className="block"
      />

      {/* ---------- Primary KPIs (real, role-aware) ---------- */}
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-3">Platform KPIs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Registered Machines"
            value={registeredMachines}
            action={<Link href="/vehicles" className="text-brand-red hover:underline">View Machine Registry →</Link>}
          />
          <KpiCard
            label="Open Quality Cases"
            value={openQualityCases}
            accent={openQualityCases > 0 ? 'text-brand-red' : 'text-brand-dark'}
            action={<Link href="/quality/dashboard" className="text-brand-red hover:underline">View Quality Dashboard →</Link>}
          />
          {canSeeImports && (
            <KpiCard
              label="Pending Imports"
              value={pendingImports ?? 0}
              action={<Link href="/admin/import-history" className="text-brand-red hover:underline">View Import History →</Link>}
            />
          )}
          {canSeeSystemHealth && syncHealth && (
            <HealthCard
              label="System Health (Vehicle Master sync)"
              status={syncStatus}
              statusLabel={syncHealth.syncStatus === 'never_run' ? 'Never run' : undefined}
              detail={`${syncHealth.totalVehicles.toLocaleString()} machines synced`}
              lastCheckedAt={syncHealth.lastSyncTime ? new Date(syncHealth.lastSyncTime).toLocaleString() : undefined}
            />
          )}
        </div>
      </div>

      {/* ---------- Quick Actions ---------- */}
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard icon="📝" label="Register New Tractor" description="Start a New Tractor Registration" href="/ntr" />
          <QuickActionCard icon="🚜" label="Machine Registry" description="Search machines by serial/model" href="/vehicles" />
          <QuickActionCard icon="⚠️" label="Quality Cases" description="Review open quality cases" href="/records" />
          {canSeeImports && (
            <QuickActionCard icon="📥" label="Legacy Import" description="Import historical NTR data" href="/admin/legacy-import" />
          )}
        </div>
      </div>

      {/* ---------- Today's Activities (real, reuses ActivityTimeline) ---------- */}
      {canSeeTodaysActivities && (
        <div>
          <h2 className="text-lg font-semibold text-brand-dark mb-3">Today&apos;s Activities</h2>
          <Card variant="flat" className="p-5">
            <ActivityTimeline events={todaysActivityEvents} entityLabel="Record" />
          </Card>
        </div>
      )}

      {/* ---------- Reserved for domains with no real data source yet ---------- */}
      <div>
        <h2 className="text-lg font-semibold text-brand-dark mb-3">Coming Soon</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <EmptyState
            icon="🛡️"
            title="Active Warranty"
            reason="No Warranty module or table exists yet - src/lib/warranty.ts is pure calculation logic, not a queryable record."
            nextStep="Planned once the Warranty module (Service domain) is built."
            comingSoon
          />
          <EmptyState
            icon="🔧"
            title="Open PM"
            reason="No aggregate 'PM due' query exists yet - due-date evaluation is per-vehicle (MaintenanceDueService), not batched."
            nextStep="Planned as a Service dashboard widget once a batched due-PM query is built."
            comingSoon
          />
          <EmptyState
            icon="📢"
            title="Recall / Service Campaigns"
            reason="No Recall or Service Campaign module exists yet."
            nextStep="Planned under Service > Campaigns. (Product Improvement Plans moved to Engineering Intelligence - see nav.)"
            comingSoon
          />
        </div>
      </div>
    </div>
  );
}

import { getSession } from '@/lib/auth';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { DeliveryService } from '@/features/delivery';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';

const service = new DeliveryService();

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="flat" className="p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-dark">{value}</p>
    </Card>
  );
}

function RankingTable({ title, rows }: { title: string; rows: { key: string; label: string; count: number }[] }) {
  return (
    <Card variant="flat" className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400">-</p>
      ) : (
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="py-1.5 pr-2 text-xs text-gray-400">#{i + 1}</td>
                <td className="py-1.5">{r.label}</td>
                <td className="py-1.5 text-right font-medium text-brand-dark">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/**
 * Delivery Dashboard (ADR-027, Output #8). KPIs reuse the same JS-side
 * aggregation shape `dashboardStats()`/`buildLeaderboard()` (`lib/db.ts`)
 * already use for Quality - not a second reporting engine.
 */
export default async function DeliveryDashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const scope = resolveDealerScope(session, null);
  const stats = await service.getDashboardStats(scope.dealerId ?? undefined);

  return (
    <div className="space-y-4">
      <PageHeader title={t('delivery.dashboardTitle')} subtitle={t('delivery.dashboardSubtitle')} titleClassName="text-2xl font-bold text-brand-dark" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label={t('delivery.pendingDeliveryLabel')} value={stats.pendingDelivery} />
        <KpiCard label={t('delivery.pendingPdiLabel')} value={stats.pendingPdi} />
        <KpiCard label={t('delivery.pendingTrainingLabel')} value={stats.pendingTraining} />
        <KpiCard label={t('delivery.warrantyPendingLabel')} value={stats.warrantyPending} />
        <KpiCard label={t('delivery.qualityPassRateLabel')} value={stats.deliveryQualityPassRate !== null ? `${stats.deliveryQualityPassRate}%` : 'N/A'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <RankingTable title={t('delivery.dealerRankingTitle')} rows={stats.dealerRanking} />
        <RankingTable title={t('delivery.technicianRankingTitle')} rows={stats.technicianRanking} />
      </div>
    </div>
  );
}

import { Suspense } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { MachineService } from '@/features/machine';
import { getVehicleBySerial } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Skeleton from '@/components/shared/layout/Skeleton';
import MachineIdentityPanel from '@/features/machine/components/MachineIdentityPanel';
import MachineLifecyclePanel from '@/features/machine/components/MachineLifecyclePanel';
import MachineOwnershipPanel from '@/features/machine/components/MachineOwnershipPanel';
import MachineHealthPanel from '@/features/machine/components/MachineHealthPanel';
import MachineKnowledgePanel from '@/features/machine/components/MachineKnowledgePanel';
import MachineAiInsightsPanel from '@/features/machine/components/MachineAiInsightsPanel';
import MachineIotPanel from '@/features/machine/components/MachineIotPanel';
import MachineWarrantySection from '@/features/machine/components/sections/MachineWarrantySection';
import MachinePmSection from '@/features/machine/components/sections/MachinePmSection';
import MachineQualitySection from '@/features/machine/components/sections/MachineQualitySection';
import MachineActivitySection from '@/features/machine/components/sections/MachineActivitySection';
import MachineDocumentsSection from '@/features/machine/components/sections/MachineDocumentsSection';
import MachineRelatedRecordsSection from '@/features/machine/components/sections/MachineRelatedRecordsSection';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { machineId: string };
}

const machineService = new MachineService();

/**
 * Machine Digital Passport v1.1 (ADR-026, refined) - the permanent home
 * for one machine, aggregating Identity/Lifecycle/Ownership/Health/
 * Warranty/PM/Quality/Related Records/Documents/Activity/Knowledge/
 * Reserved AI/Future IoT. `machineId` is the machine's Serial Number (same
 * identifier `/vehicles/[serial]` already keys on) - not the `vehicles.id`
 * UUID, since a search result can reference a Tractor-IN-sheet row that
 * hasn't synced into `vehicles` yet and would have no `id` to route on.
 * See `docs/architecture/MACHINE_PASSPORT_ARCHITECTURE.md`.
 *
 * v1.1 refinement (post-PR #39 review) added Machine Health, Knowledge
 * Score, Lifecycle Timeline filtering, Related Records, and Reserved AI -
 * every new widget reuses an existing MSEAL primitive
 * (`HealthCard`/`EmptyState`/the existing list-row pattern), no new table,
 * no new authorization surface, and the Lifecycle milestone timeline is
 * still the one `MachineService.getMachineTimeline()` feed (filtering is
 * a client-side show/hide over the same rows, not a second timeline).
 *
 * Every section below is either read from `MachineService` (a thin facade
 * over existing module reads - ADR-009) or is a self-contained async
 * "section" component wrapped in its own `<Suspense>` boundary, so a slow
 * Warranty/PM/Quality/Related Records/Documents/Activity query never
 * blocks the sections above it from painting (Machine Digital Passport's
 * "load sections independently, lazy-load heavy widgets" requirement) -
 * matching the MSEAL Design Framework's Skeleton-loading guidance instead
 * of a full-page spinner.
 */
export default async function MachinePassportPage({ params }: RouteParams) {
  const machineId = decodeURIComponent(params.machineId);
  const session = await getSession();
  if (!session) return null;

  const [summary, timeline, vehicleRow] = await Promise.all([
    machineService.getMachine360(machineId, session),
    machineService.getMachineTimeline(machineId, session),
    getVehicleBySerial(machineId, resolveDealerScope(session, null)),
  ]);

  if (!summary) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('machinePassport.title')}
          subtitle={`${t('common.serial')}: ${machineId}`}
          actions={
            <Link href="/machines" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('machinePassport.searchAgain')}
            </Link>
          }
        />
        <div className="rounded border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p className="font-semibold">{t('machinePassport.notFoundTitle')}</p>
          <p className="text-sm">{t('machinePassport.notFoundReason')}</p>
          <p className="text-sm">{t('machinePassport.notFoundNextStep')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('machinePassport.title')}
        subtitle={`${summary.serial} ${summary.model ? `· ${summary.model}` : ''}`}
        actions={
          <Link href="/machines" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            {t('machinePassport.searchAgain')}
          </Link>
        }
      />

      <MachineIdentityPanel summary={summary} subModel={vehicleRow?.sub_model ?? null} />
      <MachineLifecyclePanel summary={summary} timeline={timeline} />
      <MachineOwnershipPanel summary={summary} />
      <MachineHealthPanel summary={summary} />

      <Suspense fallback={<Skeleton lines={3} className="rounded border border-gray-200 bg-white p-6" />}>
        <MachineWarrantySection serial={machineId} session={session} />
      </Suspense>

      <Suspense fallback={<Skeleton lines={3} className="rounded border border-gray-200 bg-white p-6" />}>
        <MachinePmSection serial={machineId} session={session} summary={summary} />
      </Suspense>

      <Suspense fallback={<Skeleton lines={3} className="rounded border border-gray-200 bg-white p-6" />}>
        <MachineQualitySection serial={machineId} session={session} />
      </Suspense>

      <Suspense fallback={<Skeleton lines={3} className="rounded border border-gray-200 bg-white p-6" />}>
        <MachineRelatedRecordsSection serial={machineId} session={session} />
      </Suspense>

      <Suspense fallback={<Skeleton lines={3} className="rounded border border-gray-200 bg-white p-6" />}>
        <MachineDocumentsSection serial={machineId} session={session} />
      </Suspense>

      <Suspense fallback={<Skeleton lines={5} className="rounded border border-gray-200 bg-white p-6" />}>
        <MachineActivitySection serial={machineId} session={session} />
      </Suspense>

      <MachineKnowledgePanel />
      <MachineAiInsightsPanel />
      <MachineIotPanel />
    </div>
  );
}

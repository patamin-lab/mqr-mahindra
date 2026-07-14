import { Suspense } from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { MachineService } from '@/features/machine';
import { getVehicleBySerial } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Skeleton from '@/components/shared/layout/Skeleton';
import MachineNextActionPanel from '@/features/machine/components/MachineNextActionPanel';
import MachineIdentityPanel from '@/features/machine/components/MachineIdentityPanel';
import MachineLifecyclePanel from '@/features/machine/components/MachineLifecyclePanel';
import MachineOwnershipPanel from '@/features/machine/components/MachineOwnershipPanel';
import MachineHealthPanel from '@/features/machine/components/MachineHealthPanel';
import MachineTroubleshootingPanel from '@/features/machine/components/MachineTroubleshootingPanel';
import MachineAiInsightsPanel from '@/features/machine/components/MachineAiInsightsPanel';
import MachineCompletenessPanel from '@/features/machine/components/MachineCompletenessPanel';
import MachineIotPanel from '@/features/machine/components/MachineIotPanel';
import MachineImportInspectionSection from '@/features/machine/components/sections/MachineImportInspectionSection';
import MachineDeliverySection from '@/features/machine/components/sections/MachineDeliverySection';
import MachineWarrantySection from '@/features/machine/components/sections/MachineWarrantySection';
import MachinePmSection from '@/features/machine/components/sections/MachinePmSection';
import MachineQualitySection from '@/features/machine/components/sections/MachineQualitySection';
import MachineActivitySection from '@/features/machine/components/sections/MachineActivitySection';
import MachineDocumentsSection from '@/features/machine/components/sections/MachineDocumentsSection';
import MachineRelatedRecordsSection from '@/features/machine/components/sections/MachineRelatedRecordsSection';
import MachineKnowledgeSection from '@/features/machine/components/sections/MachineKnowledgeSection';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { machineId: string };
}

const machineService = new MachineService();

/**
 * Machine Digital Passport v1.5 (ADR-026, refined) - the permanent home
 * for one machine, aggregating Next Recommended Action/Identity/Lifecycle/
 * Ownership/Health/Delivery/Warranty/PM/Quality/Related Records/Documents/
 * Activity/Knowledge/Troubleshooting/Reserved AI/Machine Completeness/
 * Future IoT.
 * `machineId` is the machine's Serial Number (same identifier
 * `/vehicles/[serial]` already keys on) - not the `vehicles.id` UUID, since
 * a search result can reference a Tractor-IN-sheet row that hasn't synced
 * into `vehicles` yet and would have no `id` to route on. See
 * `docs/architecture/MACHINE_PASSPORT_ARCHITECTURE.md`.
 *
 * v1.1 refinement (post-PR #39 review) added Machine Health, Knowledge
 * Score, Lifecycle Timeline filtering, Related Records, and Reserved AI.
 * v1.2 refinement added Machine Completeness (a Data Quality placeholder),
 * Next Recommended Action (a future AI entry point placeholder), and split
 * Related Records into Open/History. v1.3 (UI Terminology & Navigation
 * Cleanup) reserves a dedicated Troubleshooting section - Quality-owned,
 * moved out of the Knowledge Integration tile grid so it isn't duplicated
 * across both. v1.4 (Engineering Knowledge Platform, ADR-018) gives
 * Knowledge its own `<Suspense>` section for the first time - it reads
 * real Published Knowledge Cases via `MachineService.getMachineKnowledgeSummary()`
 * -> `KnowledgeService`, never a direct query - Machine still owns no
 * Knowledge data. AI Recommendation/Prediction/Knowledge Score stay
 * Coming Soon. v1.5 (Machine Delivery Platform, ADR-017/ADR-027) gives
 * Delivery its own `<Suspense>` section, placed before Warranty to match
 * the real-world chronology (Tractor In -> Stock Yard -> PDI -> Delivery
 * -> Warranty) - reads via `MachineService.getMachineDeliverySummary()`
 * -> `DeliveryService`, never a direct query; Machine still owns no
 * Delivery data. Every new widget across all five refinements reuses an
 * existing MSEAL primitive
 * (`HealthCard`/`EmptyState`/`StatusPill`/the existing list-row pattern),
 * no new table, no new authorization surface, and the Lifecycle milestone
 * timeline is still the one `MachineService.getMachineTimeline()` feed
 * (filtering is a client-side show/hide over the same rows, not a second
 * timeline).
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

      <MachineNextActionPanel />

      <MachineIdentityPanel
        summary={summary}
        subModel={vehicleRow?.sub_model ?? null}
        productCode={vehicleRow?.product_code ?? null}
        whArrivalDate={vehicleRow?.wh_arrival_date ?? null}
      />
      <MachineLifecyclePanel summary={summary} timeline={timeline} />
      <MachineOwnershipPanel summary={summary} />
      <MachineHealthPanel summary={summary} />

      <Suspense fallback={<Skeleton lines={3} className="rounded border border-gray-200 bg-white p-6" />}>
        <MachineImportInspectionSection serial={machineId} session={session} />
      </Suspense>

      <Suspense fallback={<Skeleton lines={3} className="rounded border border-gray-200 bg-white p-6" />}>
        <MachineDeliverySection serial={machineId} />
      </Suspense>

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

      <Suspense fallback={<Skeleton lines={3} className="rounded border border-gray-200 bg-white p-6" />}>
        <MachineKnowledgeSection serial={machineId} />
      </Suspense>
      <MachineTroubleshootingPanel />
      <MachineAiInsightsPanel />
      <MachineCompletenessPanel />
      <MachineIotPanel />
    </div>
  );
}

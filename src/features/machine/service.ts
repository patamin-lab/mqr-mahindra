/**
 * MachineService — Machine 360 / Machine Timeline facade (ADR-009).
 *
 * A thin wrapper over `features/vehicle/service.ts`'s existing aggregation
 * logic (`getVehicleSummary`/`getVehicleTimeline`) - chosen over renaming
 * `src/features/vehicle/` itself because no `VehicleRepository`/
 * `VehicleService` class existed to rename, and the aggregation logic
 * inside `vehicle/service.ts` (provider merge, Health Score computation)
 * is unchanged business logic, not something this pass touches. New code
 * (and all new UI/docs) should call `MachineService`, not
 * `features/vehicle/service.ts`, directly.
 */
import { SessionUser, OPEN_STATUSES } from '@/lib/types';
import { getVehicleSummary, getVehicleTimeline } from '@/features/vehicle/service';
import { fetchMqrRecords } from '@/features/vehicle/eventSources/mqrEvents';
import { fetchMaintenanceHistoryForSerial } from '@/features/maintenance/utils/fetchMaintenanceHistory';
import { fetchNtrRecordsForSerial } from '@/features/ntr/utils/fetchNtrRecordsForSerial';
import { Attachment, AttachmentService } from '@/shared/attachments';
import { calcWarranty } from '@/lib/warranty';
import { listAuditLogForRecords } from '@/lib/db';
import { mapMixedAuditLogToActivityEvents } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';
import type { ActivityEvent } from '@/components/shared/activity-timeline/types';
import { MachineEvent, MachineSummary, MachineWarrantySummary, MachineQualitySummary, MachineRelatedRecord } from './types';

export class MachineService {
  constructor(private readonly attachmentService: AttachmentService = new AttachmentService()) {}

  async getMachine360(serial: string, session: SessionUser): Promise<MachineSummary | null> {
    return getVehicleSummary(serial, session);
  }

  async getMachineTimeline(serial: string, session: SessionUser): Promise<MachineEvent[]> {
    return getVehicleTimeline(serial, session);
  }

  /** Machine 360's Attachments section - reads only through
   *  `AttachmentService`, never a storage provider or module table
   *  directly (ADR-010). Same dependency direction as the Timeline
   *  (`vehicle/eventSources`) and Summary (`VehicleSummaryProvider`)
   *  aggregations: Machine depends on MQR/Maintenance/NTR's own scoped
   *  "records for this serial" utilities, never the reverse, and never a
   *  raw Supabase query of its own. A future module (PDI, Campaign) adds
   *  its own two-line block here once it adopts the Attachment Platform -
   *  see docs/engineering/ATTACHMENT_FRAMEWORK.md. */
  async getMachineAttachments(serial: string, session: SessionUser): Promise<Attachment[]> {
    const [mqrRecords, pmRecords, ntrRecords] = await Promise.all([
      fetchMqrRecords(serial, session),
      fetchMaintenanceHistoryForSerial(serial, session),
      fetchNtrRecordsForSerial(serial, session),
    ]);

    const lists = await Promise.all([
      ...mqrRecords.map((r) => this.attachmentService.list('mqr', 'record', r.job_id)),
      ...pmRecords.map((r) => this.attachmentService.list('pm', 'pm_record', r.id)),
      ...ntrRecords.map((r) => this.attachmentService.list('ntr', 'ntr_record', r.id)),
    ]);
    return lists.flat();
  }

  /**
   * Machine Digital Passport's Warranty section (v1.0, new - no prior
   * consumer computed this). Reuses `fetchMqrRecords()` (the same scoped
   * MQR-for-this-serial read `getMachineAttachments()` above already
   * uses) and the existing `calcWarranty()` (`lib/warranty.ts`, unchanged)
   * - no new warranty table, no new calculation rule. Overall status is
   * computed from the vehicle's own delivery/retail date (via Machine
   * 360's summary), 'powertrain' coverage (the broader of the two
   * `calcWarranty()` classes) - a single vehicle-level read, distinct from
   * each MQR record's own per-complaint `warranty_status` snapshot, which
   * is listed under `claims` unchanged. See
   * `docs/architecture/MACHINE_DATA_OWNERSHIP.md` for why there is no
   * dedicated Warranty table to read from instead.
   */
  async getMachineWarrantySummary(serial: string, session: SessionUser): Promise<MachineWarrantySummary> {
    const [summary, mqrRecords] = await Promise.all([
      getVehicleSummary(serial, session),
      fetchMqrRecords(serial, session),
    ]);

    const overall = summary?.retailDate ? calcWarranty(summary.retailDate, new Date().toISOString().slice(0, 10), 'powertrain') : null;

    return {
      status: overall?.status ?? null,
      ageMonths: overall?.ageMonths ?? null,
      limitMonths: overall?.limitMonths ?? null,
      claims: mqrRecords
        .filter((r) => !!r.warranty_status)
        .map((r) => ({
          jobId: r.job_id,
          foundDate: r.found_date,
          problemSystem: r.problem_system,
          warrantyStatus: r.warranty_status,
          recordStatus: r.status,
        })),
    };
  }

  /**
   * Machine Digital Passport's Quality section (v1.0, new). Reuses the
   * same scoped `fetchMqrRecords()` read and the existing `OPEN_STATUSES`
   * constant (`lib/types.ts`) that `dashboardStats()`/Platform Overview's
   * `countOpenQualityCases()` already use for "what counts as open" - one
   * definition, three consumers, never redefined per caller.
   */
  async getMachineQualitySummary(serial: string, session: SessionUser): Promise<MachineQualitySummary> {
    const mqrRecords = await fetchMqrRecords(serial, session);
    const openStatuses = new Set<string>(OPEN_STATUSES);

    let openCount = 0;
    let closedCount = 0;
    let criticalCount = 0;
    for (const r of mqrRecords) {
      if (openStatuses.has(r.status)) openCount++;
      else closedCount++;
      if (r.severity === 'Critical') criticalCount++;
    }

    return {
      openCount,
      closedCount,
      criticalCount,
      cases: mqrRecords.map((r) => ({ jobId: r.job_id, status: r.status, severity: r.severity, foundDate: r.found_date })),
    };
  }

  /**
   * Machine Digital Passport's "Machine Timeline" (v1.0) - reuses the
   * platform-standard `<ActivityTimeline>` component (MSEAL Design
   * Framework, ADR-023) via the exact same cross-record adapter Platform
   * Overview's "Today's Activities" widget uses
   * (`mapMixedAuditLogToActivityEvents()`), fed by every `record_audit_log`
   * row belonging to any of this machine's own MQR/PM/NTR records. This is
   * a field-level change/audit feed, distinct from - not a duplicate of -
   * `getMachineTimeline()` above, which shows coarse Machine Lifecycle
   * milestones (`vehicle_events`, e.g. one "NTR Completed" row); this
   * shows every individual field/status/photo change underneath those
   * milestones. See `docs/architecture/MACHINE_PASSPORT_ARCHITECTURE.md`
   * for the full distinction - both are shown, neither replaces the other.
   */
  async getMachineAuditTimeline(serial: string, session: SessionUser): Promise<ActivityEvent[]> {
    const [mqrRecords, pmRecords, ntrRecords] = await Promise.all([
      fetchMqrRecords(serial, session),
      fetchMaintenanceHistoryForSerial(serial, session),
      fetchNtrRecordsForSerial(serial, session),
    ]);

    const refs = [
      ...mqrRecords.map((r) => ({ module: 'mqr' as const, recordId: r.id })),
      ...pmRecords.map((r) => ({ module: 'pm' as const, recordId: r.id })),
      ...ntrRecords.map((r) => ({ module: 'ntr' as const, recordId: r.id })),
    ];
    if (refs.length === 0) return [];

    const entries = await listAuditLogForRecords(refs);
    return mapMixedAuditLogToActivityEvents(entries);
  }

  /**
   * Machine Digital Passport v1.1 refinement - Related Records panel.
   * Reuses the exact same three scoped "records for this serial" reads
   * `getMachineAttachments()`/`getMachineAuditTimeline()` already call
   * (`fetchMqrRecords`, `fetchMaintenanceHistoryForSerial`,
   * `fetchNtrRecordsForSerial`) - no new query, no new table - just
   * flattened into one cross-module list with a link to each record's own
   * detail page, instead of scattering job/PM/NTR references across
   * Warranty Claims/PM History/Quality Cases with no single place that
   * lists them all together.
   */
  async getMachineRelatedRecords(serial: string, session: SessionUser): Promise<MachineRelatedRecord[]> {
    const [mqrRecords, pmRecords, ntrRecords] = await Promise.all([
      fetchMqrRecords(serial, session),
      fetchMaintenanceHistoryForSerial(serial, session),
      fetchNtrRecordsForSerial(serial, session),
    ]);

    return [
      ...mqrRecords.map((r) => ({
        module: 'mqr' as const,
        recordId: r.id,
        reference: r.job_id,
        status: r.status,
        date: r.found_date,
        href: `/records/${encodeURIComponent(r.job_id)}`,
      })),
      ...pmRecords.map((r) => ({
        module: 'pm' as const,
        recordId: r.id,
        reference: r.pm_number ?? r.id,
        status: null,
        date: r.performed_date,
        href: `/pm-records/${r.id}`,
      })),
      ...ntrRecords.map((r) => ({
        module: 'ntr' as const,
        recordId: r.id,
        reference: r.ntr_number,
        status: r.status,
        date: r.delivery_date,
        href: `/ntr/${r.id}`,
      })),
    ];
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/types';

const {
  mockGetVehicleSummary,
  mockFetchMqrRecords,
  mockFetchMaintenanceHistory,
  mockFetchNtrRecords,
  mockListAuditLogForRecords,
  mockMapMixedAuditLogToActivityEvents,
} = vi.hoisted(() => ({
  mockGetVehicleSummary: vi.fn(),
  mockFetchMqrRecords: vi.fn(),
  mockFetchMaintenanceHistory: vi.fn(),
  mockFetchNtrRecords: vi.fn(),
  mockListAuditLogForRecords: vi.fn(),
  mockMapMixedAuditLogToActivityEvents: vi.fn(),
}));

vi.mock('@/features/vehicle/service', () => ({
  getVehicleSummary: mockGetVehicleSummary,
  getVehicleTimeline: vi.fn(() => Promise.resolve([])),
}));
vi.mock('@/features/vehicle/eventSources/mqrEvents', () => ({
  fetchMqrRecords: mockFetchMqrRecords,
}));
vi.mock('@/features/maintenance/utils/fetchMaintenanceHistory', () => ({
  fetchMaintenanceHistoryForSerial: mockFetchMaintenanceHistory,
}));
vi.mock('@/features/ntr/utils/fetchNtrRecordsForSerial', () => ({
  fetchNtrRecordsForSerial: mockFetchNtrRecords,
}));
vi.mock('@/lib/db', () => ({
  listAuditLogForRecords: mockListAuditLogForRecords,
}));
vi.mock('@/components/shared/activity-timeline/mapAuditLogToActivityEvents', () => ({
  mapMixedAuditLogToActivityEvents: mockMapMixedAuditLogToActivityEvents,
}));

import { MachineService } from './service';

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    username: 'alice',
    fullName: 'Alice',
    role: 'DealerUser',
    dealerId: 'D1',
    branch: null,
    branchId: 'B1',
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  };
}

const service = new MachineService();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MachineService.getMachineWarrantySummary', () => {
  it('computes overall status from retailDate via the existing calcWarranty() - no new calculation', async () => {
    mockGetVehicleSummary.mockResolvedValue({ retailDate: '2024-01-01' });
    mockFetchMqrRecords.mockResolvedValue([
      { job_id: 'QIR-1', found_date: '2026-01-01', problem_system: 'Engine', warranty_status: 'อยู่ในประกัน', status: 'Closed' },
      { job_id: 'QIR-2', found_date: '2026-01-02', problem_system: null, warranty_status: null, status: 'Open' },
    ]);

    const result = await service.getMachineWarrantySummary('S1', session());

    expect(result.status).not.toBeNull();
    expect(result.limitMonths).toBe(48);
    // Only the claim with a non-null warranty_status is included - the
    // second record (no warranty_status recorded on the MQR row) is
    // excluded, not backfilled with a guess.
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].jobId).toBe('QIR-1');
  });

  it('returns a null overall status when there is no retail/delivery date to compute from yet', async () => {
    mockGetVehicleSummary.mockResolvedValue({ retailDate: null });
    mockFetchMqrRecords.mockResolvedValue([]);

    const result = await service.getMachineWarrantySummary('S1', session());
    expect(result.status).toBeNull();
    expect(result.ageMonths).toBeNull();
    expect(result.claims).toEqual([]);
  });
});

describe('MachineService.getMachineQualitySummary', () => {
  it('counts open/closed/critical using the shared OPEN_STATUSES constant, not a redefined rule', async () => {
    mockFetchMqrRecords.mockResolvedValue([
      { job_id: 'QIR-1', status: 'Open', severity: 'Critical', found_date: '2026-01-01' },
      { job_id: 'QIR-2', status: 'Closed', severity: 'Minor', found_date: '2026-01-02' },
      { job_id: 'QIR-3', status: 'UnderInvestigation', severity: 'Critical', found_date: '2026-01-03' },
    ]);

    const result = await service.getMachineQualitySummary('S1', session());

    expect(result.openCount).toBe(2);
    expect(result.closedCount).toBe(1);
    expect(result.criticalCount).toBe(2);
    expect(result.cases).toHaveLength(3);
  });
});

describe('MachineService.getMachineAuditTimeline', () => {
  it('short-circuits to [] without querying the audit log when the machine has no records in any module', async () => {
    mockFetchMqrRecords.mockResolvedValue([]);
    mockFetchMaintenanceHistory.mockResolvedValue([]);
    mockFetchNtrRecords.mockResolvedValue([]);

    const result = await service.getMachineAuditTimeline('S1', session());

    expect(result).toEqual([]);
    expect(mockListAuditLogForRecords).not.toHaveBeenCalled();
  });

  it('collects record refs across MQR/PM/NTR and reuses the shared mapMixedAuditLogToActivityEvents adapter', async () => {
    mockFetchMqrRecords.mockResolvedValue([{ id: 'mqr-1' }]);
    mockFetchMaintenanceHistory.mockResolvedValue([{ id: 'pm-1' }]);
    mockFetchNtrRecords.mockResolvedValue([{ id: 'ntr-1' }]);
    mockListAuditLogForRecords.mockResolvedValue([{ id: 'entry-1' }]);
    mockMapMixedAuditLogToActivityEvents.mockReturnValue([{ eventId: 'entry-1' }]);

    const result = await service.getMachineAuditTimeline('S1', session());

    expect(mockListAuditLogForRecords).toHaveBeenCalledWith([
      { module: 'mqr', recordId: 'mqr-1' },
      { module: 'pm', recordId: 'pm-1' },
      { module: 'ntr', recordId: 'ntr-1' },
    ]);
    expect(mockMapMixedAuditLogToActivityEvents).toHaveBeenCalledWith([{ id: 'entry-1' }]);
    expect(result).toEqual([{ eventId: 'entry-1' }]);
  });
});

describe('MachineService.getMachineRelatedRecords', () => {
  it('buckets MQR by the shared OPEN_STATUSES rule, and PM/NTR always as history', async () => {
    mockFetchMqrRecords.mockResolvedValue([
      { id: 'mqr-1', job_id: 'QIR-1', status: 'Open', found_date: '2026-01-01' },
      { id: 'mqr-2', job_id: 'QIR-2', status: 'Closed', found_date: '2026-01-02' },
    ]);
    mockFetchMaintenanceHistory.mockResolvedValue([{ id: 'pm-1', pm_number: 'PM-1', performed_date: '2026-01-03' }]);
    mockFetchNtrRecords.mockResolvedValue([{ id: 'ntr-1', ntr_number: 'NTR-1', status: 'Completed', delivery_date: '2026-01-04' }]);

    const result = await service.getMachineRelatedRecords('S1', session());

    const mqrOpen = result.find((r) => r.recordId === 'mqr-1')!;
    const mqrClosed = result.find((r) => r.recordId === 'mqr-2')!;
    const pm = result.find((r) => r.recordId === 'pm-1')!;
    const ntr = result.find((r) => r.recordId === 'ntr-1')!;

    expect(mqrOpen.bucket).toBe('open');
    expect(mqrClosed.bucket).toBe('history');
    expect(pm.bucket).toBe('history');
    expect(ntr.bucket).toBe('history');
    expect(pm.href).toBe('/pm-records/pm-1');
    expect(ntr.href).toBe('/ntr/ntr-1');
    expect(mqrOpen.href).toBe('/records/QIR-1');
  });
});

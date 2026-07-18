import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetVehicleBySerial, mockGetDealer, mockGetBranchById, mockProvider } = vi.hoisted(() => ({
  mockGetVehicleBySerial: vi.fn(),
  mockGetDealer: vi.fn(),
  mockGetBranchById: vi.fn(),
  mockProvider: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getVehicleBySerial: mockGetVehicleBySerial,
  getDealer: mockGetDealer,
  getBranchById: mockGetBranchById,
}));

vi.mock('@/lib/dealerBranchScope', () => ({
  resolveDealerScope: vi.fn(() => ({ unrestricted: true, dealerId: null, branchId: null })),
}));

vi.mock('@/features/vehicle/providers/registry', () => ({
  VEHICLE_SUMMARY_PROVIDERS: [{ getVehicleSummary: mockProvider }],
}));

vi.mock('./registry', () => ({ VEHICLE_EVENT_SOURCES: [] }));

vi.mock('@/features/vehicle-health/service', () => ({
  VehicleHealthService: vi.fn(function () {
    return { calculate: vi.fn(() => ({ score: 100, status: 'healthy' })) };
  }),
}));

import { getVehicleSummary } from './service';

const session = { role: 'SuperAdmin', dealerId: null } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBranchById.mockResolvedValue(null);
  mockProvider.mockResolvedValue(null);
});

describe('getVehicleSummary master-field compatibility', () => {
  it('uses NTR dealer and delivery fields when the vehicle master row is still missing them', async () => {
    mockGetVehicleBySerial.mockResolvedValue({
      serial: 'SN-1',
      model: 'M1',
      engine_number: 'E1',
      delivery_date: null,
      dealer_id: null,
      branch_id: null,
    });
    mockProvider.mockResolvedValue({ dealerId: 'D1', retailDate: '2026-07-15' });
    mockGetDealer.mockResolvedValue({ id: 'D1', short_name: '', full_name: 'Dealer One' });

    const result = await getVehicleSummary('SN-1', session);

    expect(result).toMatchObject({ dealerId: 'D1', dealerName: 'Dealer One', retailDate: '2026-07-15' });
  });

  it('keeps populated vehicle master dealer and delivery values authoritative', async () => {
    mockGetVehicleBySerial.mockResolvedValue({
      serial: 'SN-1',
      model: 'M1',
      engine_number: 'E1',
      delivery_date: '2026-07-01',
      dealer_id: 'D1',
      branch_id: null,
    });
    mockProvider.mockResolvedValue({ dealerId: 'D2', retailDate: '2026-08-01' });
    mockGetDealer.mockResolvedValue({ id: 'D1', short_name: 'D1', full_name: 'Dealer One' });

    const result = await getVehicleSummary('SN-1', session);

    expect(result).toMatchObject({ dealerId: 'D1', dealerName: 'D1', retailDate: '2026-07-01' });
  });
});

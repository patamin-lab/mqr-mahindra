import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetVehicleBySerial, mockGetVehicleEvents } = vi.hoisted(() => ({
  mockGetVehicleBySerial: vi.fn(),
  mockGetVehicleEvents: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ getVehicleBySerial: mockGetVehicleBySerial }));
vi.mock('@/lib/dealerBranchScope', () => ({
  resolveDealerScope: vi.fn(() => ({ unrestricted: true, dealerId: null, branchId: null })),
}));
vi.mock('@/features/vehicle-event/factory', () => ({
  createVehicleEventService: vi.fn(() => ({ getVehicleEvents: mockGetVehicleEvents })),
}));

import { getPlatformEvents } from './platformEvents';

const session = { role: 'SuperAdmin', dealerId: null } as any;

function platformEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    vehicle_id: 'vehicle-1',
    event_definition_id: 'definition-1',
    source_module: 'delivery',
    reference_id: 'DEL-2026-000001',
    event_datetime: '2026-07-15T06:34:36.516+00:00',
    title: 'Warranty activated',
    description: null,
    metadata: { event_code: 'WARRANTY_ACTIVATED' },
    status: 'Completed',
    created_by: 'admin',
    created_at: '2026-07-15T06:34:36.516+00:00',
    updated_by: null,
    updated_at: '2026-07-15T06:34:36.516+00:00',
    record_status: 'Active',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetVehicleBySerial.mockResolvedValue({ id: 'vehicle-1', delivery_date: '2025-10-11' });
});

describe('getPlatformEvents warranty timeline compatibility', () => {
  it('uses the delivery date for historic warranty events instead of their processing timestamp', async () => {
    mockGetVehicleEvents.mockResolvedValue([platformEvent()]);

    const events = await getPlatformEvents('SN-001', session);

    expect(events).toMatchObject([{ type: 'WarrantyActivated', date: '2025-10-11' }]);
  });

  it('keeps the original timestamp for non-warranty platform events', async () => {
    mockGetVehicleEvents.mockResolvedValue([
      platformEvent({ metadata: { event_code: 'PDI_COMPLETED' }, event_datetime: '2026-07-15T06:34:36.516+00:00' }),
    ]);

    const events = await getPlatformEvents('SN-001', session);

    expect(events).toMatchObject([{ type: 'PdiCompleted', date: '2026-07-15T06:34:36.516+00:00' }]);
  });

  it('retains the event timestamp if no delivery date is available', async () => {
    mockGetVehicleBySerial.mockResolvedValue({ id: 'vehicle-1', delivery_date: null });
    mockGetVehicleEvents.mockResolvedValue([platformEvent()]);

    const events = await getPlatformEvents('SN-001', session);

    expect(events).toMatchObject([{ type: 'WarrantyActivated', date: '2026-07-15T06:34:36.516+00:00' }]);
  });
});

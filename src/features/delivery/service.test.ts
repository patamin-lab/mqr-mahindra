import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/types';
import type { DeliveryRecord } from './types';

const { mockLogAuditEvent } = vi.hoisted(() => ({
  mockLogAuditEvent: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

import { DeliveryService } from './service';
import type { DeliveryRepository } from './repository';

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    username: 'admin1',
    fullName: 'Admin One',
    role: 'DealerAdmin',
    dealerId: 'D1',
    branch: null,
    branchId: 'B1',
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  };
}

function baseRecord(overrides: Partial<DeliveryRecord> = {}): DeliveryRecord {
  return {
    id: 'del-1',
    deliveryRef: 'DEL-2026-000001',
    vehicleId: 'veh-1',
    serial: 'SN-001',
    dealerId: 'D1',
    stage: 'TractorIn',
    stockYardReceivedAt: null,
    stockYardLocation: null,
    pdiInspectionId: null,
    dealerPreparationCompletedAt: null,
    dealerPreparationNotes: null,
    ntrId: null,
    trainingId: null,
    acceptanceSignedAt: null,
    acceptanceSignedBy: null,
    acceptanceNotes: null,
    warrantyActivatedAt: null,
    warrantyActivationSource: null,
    overallStatus: 'InProgress',
    createdBy: 'admin1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00Z',
    recordStatus: 'Active',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DeliveryRepository> = {}): DeliveryRepository {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    getMostRecentForSerial: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    createTraining: vi.fn(),
    getTrainingById: vi.fn(),
    listActiveWithRelated: vi.fn(() => Promise.resolve([])),
    ...overrides,
  } as unknown as DeliveryRepository;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DeliveryService.recordAcceptance', () => {
  it('throws for DealerUser (only SuperAdmin/CentralAdmin/DealerAdmin may record acceptance)', async () => {
    const repo = makeRepo();
    const service = new DeliveryService(repo);

    await expect(service.recordAcceptance('del-1', { acceptanceNotes: null }, session({ role: 'DealerUser' }))).rejects.toThrow(/may not record Delivery Acceptance/);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('records acceptance then auto-activates Warranty (closing the "never emitted as an event" gap)', async () => {
    const afterAcceptance = baseRecord({ stage: 'WarrantyActivation', acceptanceSignedAt: '2026-02-01T00:00:00Z', acceptanceSignedBy: 'admin1' });
    const afterWarranty = baseRecord({ stage: 'Completed', overallStatus: 'Completed', warrantyActivatedAt: '2026-02-01T00:00:00Z', warrantyActivationSource: 'DeliveryAcceptance' });
    const repo = makeRepo({
      update: vi.fn()
        .mockResolvedValueOnce(afterAcceptance)
        .mockResolvedValueOnce(afterWarranty),
    });
    const service = new DeliveryService(repo);

    const result = await service.recordAcceptance('del-1', { acceptanceNotes: 'Customer happy' }, session());

    expect(result.warrantyActivatedAt).toBe('2026-02-01T00:00:00Z');
    expect(result.warrantyActivationSource).toBe('DeliveryAcceptance');
    expect(result.stage).toBe('Completed');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ module: 'delivery', fieldName: 'Acceptance' }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ module: 'delivery', fieldName: 'WarrantyActivated', newValue: 'DeliveryAcceptance' }));
  });
});

describe('DeliveryService.activateWarranty', () => {
  it('rejects a Manual activation from a DealerUser', async () => {
    const repo = makeRepo();
    const service = new DeliveryService(repo);

    await expect(service.activateWarranty('del-1', 'Manual', session({ role: 'DealerUser' }))).rejects.toThrow(/may not manually activate Warranty/);
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('DeliveryService.recordTraining', () => {
  it('creates a training row, links it, and advances stage to DeliveryAcceptance', async () => {
    const existing = baseRecord({ stage: 'OperatorTraining' });
    const training = { id: 'train-1', deliveryRecordId: 'del-1', serial: 'SN-001', operatorName: 'John', operatorPhone: null, trainerName: 'Bob', trainerId: null, trainingTopics: [], trainingDate: '2026-02-01', trainingDurationMinutes: 60, customerSatisfactionScore: 5, notes: null, createdBy: 'admin1', createdAt: '2026-02-01T00:00:00Z', recordStatus: 'Active' as const };
    const updated = baseRecord({ stage: 'DeliveryAcceptance', trainingId: 'train-1' });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      createTraining: vi.fn(() => Promise.resolve(training)),
      update: vi.fn(() => Promise.resolve(updated)),
    });
    const service = new DeliveryService(repo);

    const result = await service.recordTraining(
      'del-1',
      { operatorName: 'John', operatorPhone: null, trainerName: 'Bob', trainerId: null, trainingTopics: [], trainingDate: '2026-02-01', trainingDurationMinutes: 60, customerSatisfactionScore: 5, notes: null },
      session()
    );

    expect(repo.createTraining).toHaveBeenCalledWith(expect.objectContaining({ deliveryRecordId: 'del-1', operatorName: 'John' }));
    expect(repo.update).toHaveBeenCalledWith('del-1', expect.objectContaining({ stage: 'DeliveryAcceptance', trainingId: 'train-1' }));
    expect(result.stage).toBe('DeliveryAcceptance');
  });
});

describe('DeliveryService.getDashboardStats', () => {
  it('computes Pending PDI / Pending Training / Warranty Pending counts and a Pass rate from PDI results', async () => {
    const rows = [
      { ...baseRecord({ id: '1', stage: 'StockYard' }), model: 'ModelA', technicianName: 'tech1', checklistVersion: 'PDI-CL-v1', pdiResult: null },
      { ...baseRecord({ id: '2', stage: 'PDI' }), model: 'ModelA', technicianName: 'tech1', checklistVersion: 'PDI-CL-v1', pdiResult: null },
      { ...baseRecord({ id: '3', stage: 'OperatorTraining' }), model: 'ModelB', technicianName: 'tech2', checklistVersion: 'PDI-CL-v1', pdiResult: 'Pass' },
      { ...baseRecord({ id: '4', stage: 'WarrantyActivation' }), model: 'ModelB', technicianName: 'tech2', checklistVersion: 'PDI-CL-v1', pdiResult: 'Fail' },
      { ...baseRecord({ id: '5', stage: 'Completed' }), model: 'ModelB', technicianName: 'tech2', checklistVersion: 'PDI-CL-v1', pdiResult: 'Pass' },
    ];
    const repo = makeRepo({ listActiveWithRelated: vi.fn(() => Promise.resolve(rows)) });
    const service = new DeliveryService(repo);

    const stats = await service.getDashboardStats();

    expect(stats.pendingPdi).toBe(2);
    expect(stats.pendingTraining).toBe(1);
    expect(stats.warrantyPending).toBe(1);
    expect(stats.pendingDelivery).toBe(4);
    expect(stats.deliveryQualityPassRate).toBeCloseTo((2 / 3) * 100, 1);
    expect(stats.technicianRanking[0]).toEqual({ key: 'tech2', label: 'tech2', count: 3 });
  });
});

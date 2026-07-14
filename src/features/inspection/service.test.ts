import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/types';
import type { Inspection } from './types';

const { mockLogAuditEvent } = vi.hoisted(() => ({
  mockLogAuditEvent: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

import { InspectionService } from './service';
import type { InspectionRepository } from './repository';
import type { KnowledgeService } from '@/features/knowledge';
import type { VehicleEventPublisher } from '@/features/vehicle-event/publisher';

function makeMockPublisher(): VehicleEventPublisher {
  return {
    publish: vi.fn(() => Promise.resolve({})),
    publishPdiCompleted: vi.fn(() => Promise.resolve({})),
    publishReleasedToDealer: vi.fn(() => Promise.resolve({})),
  } as unknown as VehicleEventPublisher;
}

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    username: 'tech1',
    fullName: 'Technician One',
    role: 'SuperAdmin',
    dealerId: null,
    branch: null,
    branchId: null,
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  };
}

function baseInspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'insp-1',
    inspectionRef: 'PDI-2026-000001',
    inspectionType: 'PDI',
    inspectionReason: 'INITIAL',
    inspectionSequence: 1,
    previousInspectionId: null,
    vehicleId: 'veh-1',
    serial: 'SN-001',
    dealerId: 'D1',
    status: 'InProgress',
    result: null,
    releaseStatus: 'Pending',
    nextRePdiDueDate: null,
    checklistVersion: 'PDI-CL-v1',
    checklist: [{ id: 'engine-oil', category: 'Engine', label: 'Engine oil level', result: 'Pass', remark: null }],
    findings: [],
    measurements: [],
    partsReplaced: [],
    factoryFeedback: null,
    technicianId: null,
    technicianName: 'tech1',
    technicianCertificationRef: null,
    signedOffBy: null,
    signedOffAt: null,
    createdBy: 'tech1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00Z',
    recordStatus: 'Active',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<InspectionRepository> = {}): InspectionRepository {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    listForSerial: vi.fn(),
    listByIds: vi.fn(),
    listActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  } as unknown as InspectionRepository;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InspectionService MSEAL-only access', () => {
  it('throws for a Dealer role on every gated action (Import Inspection belongs exclusively to MSEAL)', async () => {
    const repo = makeRepo();
    const service = new InspectionService(repo);

    await expect(service.getInspection('insp-1', session({ role: 'DealerAdmin' }))).rejects.toThrow(/may not access Import Inspection/);
    await expect(service.completeInspection('insp-1', session({ role: 'DealerUser' }))).rejects.toThrow(/may not access Import Inspection/);
    expect(repo.getById).not.toHaveBeenCalled();
  });
});

describe('InspectionService.completeInspection', () => {
  it('rejects completion while any checklist item has no result', async () => {
    const existing = baseInspection({ checklist: [{ id: 'a', category: 'Engine', label: 'x', result: null, remark: null }] });
    const repo = makeRepo({ getById: vi.fn(() => Promise.resolve(existing)) });
    const service = new InspectionService(repo);

    await expect(service.completeInspection('insp-1', session())).rejects.toThrow(/no result recorded/);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('marks Pass, sets a Next RE-PDI Due Date, and leaves Release Status Pending (Release to Dealer is always a separate, explicit action)', async () => {
    const existing = baseInspection();
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      update: vi.fn((_id, patch) => Promise.resolve({ ...existing, ...patch })),
    });
    const service = new InspectionService(repo, undefined, makeMockPublisher());

    const result = await service.completeInspection('insp-1', session());

    expect(result.result).toBe('Pass');
    expect(result.releaseStatus).toBe('Pending');
    expect(result.nextRePdiDueDate).not.toBeNull();
    expect(repo.update).toHaveBeenCalledWith('insp-1', expect.objectContaining({ status: 'Completed', result: 'Pass', releaseStatus: 'Pending' }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ module: 'pdi', eventType: 'StatusChanged', newValue: 'Completed' }));
  });

  it('marks Fail and sets Release Status RequiresRePdi (not silently Pass) when a checklist item fails and a finding was recorded', async () => {
    const existing = baseInspection({
      checklist: [{ id: 'a', category: 'Engine', label: 'x', result: 'Fail', remark: 'leak' }],
      findings: [{ id: 'f1', severity: 'Major', system: 'Engine', description: 'Oil leak', disposition: 'PendingReview', factoryFeedbackStatus: 'NotSent', correctiveActionReference: null, knowledgeCaseId: null }],
    });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      update: vi.fn((_id, patch) => Promise.resolve({ ...existing, ...patch })),
    });
    const service = new InspectionService(repo, undefined, makeMockPublisher());

    const result = await service.completeInspection('insp-1', session());
    expect(result.result).toBe('Fail');
    expect(result.releaseStatus).toBe('RequiresRePdi');
    expect(result.nextRePdiDueDate).toBeNull();
  });
});

describe('InspectionService.createRePdi', () => {
  it('chains a new inspection to the one it follows - immutable, never overwrites the previous record', async () => {
    const previous = baseInspection({ id: 'insp-1', inspectionSequence: 1 });
    const created = baseInspection({ id: 'insp-2', inspectionType: 'RE_PDI', inspectionReason: 'STORAGE_EXPIRED', inspectionSequence: 2, previousInspectionId: 'insp-1' });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(previous)),
      create: vi.fn(() => Promise.resolve(created)),
    });
    const service = new InspectionService(repo);

    const result = await service.createRePdi('insp-1', { reason: 'STORAGE_EXPIRED', technicianId: null, technicianName: 'tech2', technicianCertificationRef: null }, session());

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ inspectionType: 'RE_PDI', inspectionSequence: 2, previousInspectionId: 'insp-1' }));
    expect(result.previousInspectionId).toBe('insp-1');
    expect(result.inspectionSequence).toBe(2);
  });
});

describe('InspectionService.releaseToDealer', () => {
  it('throws for a Dealer role', async () => {
    const repo = makeRepo();
    const service = new InspectionService(repo);

    await expect(service.releaseToDealer('insp-1', session({ role: 'DealerAdmin' }))).rejects.toThrow(/may not access Import Inspection/);
    expect(repo.getById).not.toHaveBeenCalled();
  });

  it('requires a Completed, Passed, signed-off inspection', async () => {
    const existing = baseInspection({ status: 'Completed', result: 'Pass', signedOffAt: null });
    const repo = makeRepo({ getById: vi.fn(() => Promise.resolve(existing)) });
    const service = new InspectionService(repo);

    await expect(service.releaseToDealer('insp-1', session())).rejects.toThrow(/before Digital Sign-off/);
  });

  it('rejects an expired inspection - RE-PDI is required first', async () => {
    const existing = baseInspection({ status: 'Completed', result: 'Pass', signedOffAt: '2026-01-02T00:00:00Z', nextRePdiDueDate: '2020-01-01' });
    const repo = makeRepo({ getById: vi.fn(() => Promise.resolve(existing)) });
    const service = new InspectionService(repo);

    await expect(service.releaseToDealer('insp-1', session())).rejects.toThrow(/expired/);
  });

  it('releases to dealer and writes a SystemEvent audit entry when Passed and signed off', async () => {
    const existing = baseInspection({ status: 'Completed', result: 'Pass', signedOffAt: '2026-01-02T00:00:00Z', nextRePdiDueDate: '2099-01-01' });
    const updated = baseInspection({ releaseStatus: 'ReleasedToDealer' });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      update: vi.fn(() => Promise.resolve(updated)),
    });
    const service = new InspectionService(repo, undefined, makeMockPublisher());

    const result = await service.releaseToDealer('insp-1', session({ username: 'admin1' }));

    expect(result.releaseStatus).toBe('ReleasedToDealer');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ module: 'pdi', eventType: 'SystemEvent', fieldName: 'ReleaseStatus', newValue: 'ReleasedToDealer' }));
  });
});

describe('InspectionService.updateFindingFactoryFeedback', () => {
  it('updates one finding\'s disposition/status/corrective action reference, not the others', async () => {
    const existing = baseInspection({
      findings: [
        { id: 'f1', severity: 'Major', system: 'Engine', description: 'Oil leak', disposition: 'PendingReview', factoryFeedbackStatus: 'NotSent', correctiveActionReference: null, knowledgeCaseId: null },
        { id: 'f2', severity: 'Minor', system: 'Electrical', description: 'Loose wire', disposition: 'PendingReview', factoryFeedbackStatus: 'NotSent', correctiveActionReference: null, knowledgeCaseId: null },
      ],
    });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      update: vi.fn((_id, patch) => Promise.resolve({ ...existing, ...patch })),
    });
    const service = new InspectionService(repo);

    const result = await service.updateFindingFactoryFeedback('insp-1', 'f1', { factoryFeedbackStatus: 'Sent', correctiveActionReference: 'CAPA-100' }, session());

    expect(result.findings.find((f) => f.id === 'f1')?.factoryFeedbackStatus).toBe('Sent');
    expect(result.findings.find((f) => f.id === 'f1')?.correctiveActionReference).toBe('CAPA-100');
    expect(result.findings.find((f) => f.id === 'f2')?.factoryFeedbackStatus).toBe('NotSent');
  });
});

describe('InspectionService.promoteFindingToKnowledge', () => {
  it('calls KnowledgeService.createCandidate + addEvidence and stores the resulting caseId on the finding - never a duplicate entry form', async () => {
    const existing = baseInspection({
      findings: [{ id: 'f1', severity: 'Major', system: 'Engine', description: 'Oil leak at seal', disposition: 'PendingReview', factoryFeedbackStatus: 'NotSent', correctiveActionReference: null, knowledgeCaseId: null }],
    });
    const updated = baseInspection({
      findings: [{ id: 'f1', severity: 'Major', system: 'Engine', description: 'Oil leak at seal', disposition: 'PendingReview', factoryFeedbackStatus: 'NotSent', correctiveActionReference: null, knowledgeCaseId: 'case-9' }],
    });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      update: vi.fn(() => Promise.resolve(updated)),
    });
    const createCandidate = vi.fn(() => Promise.resolve({ id: 'case-9', caseRef: 'KNOW-2026-000009' }));
    const addEvidence = vi.fn(() => Promise.resolve({}));
    const knowledgeService = { createCandidate, addEvidence } as unknown as KnowledgeService;
    const service = new InspectionService(repo, knowledgeService);

    const result = await service.promoteFindingToKnowledge('insp-1', 'f1', session());

    expect(createCandidate).toHaveBeenCalledWith(expect.objectContaining({ symptom: 'Oil leak at seal', affectedSystem: 'Engine' }), expect.anything());
    expect(addEvidence).toHaveBeenCalledWith('case-9', expect.objectContaining({ sourceType: 'Inspection', sourceModule: 'pdi' }), expect.anything());
    expect(result.findings[0].knowledgeCaseId).toBe('case-9');
  });

  it('is a no-op if the finding was already promoted', async () => {
    const existing = baseInspection({
      findings: [{ id: 'f1', severity: 'Major', system: 'Engine', description: 'Oil leak', disposition: 'PendingReview', factoryFeedbackStatus: 'NotSent', correctiveActionReference: null, knowledgeCaseId: 'case-9' }],
    });
    const repo = makeRepo({ getById: vi.fn(() => Promise.resolve(existing)) });
    const createCandidate = vi.fn();
    const knowledgeService = { createCandidate } as unknown as KnowledgeService;
    const service = new InspectionService(repo, knowledgeService);

    await service.promoteFindingToKnowledge('insp-1', 'f1', session());
    expect(createCandidate).not.toHaveBeenCalled();
  });
});

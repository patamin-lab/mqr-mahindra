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

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    username: 'tech1',
    fullName: 'Technician One',
    role: 'DealerUser',
    dealerId: 'D1',
    branch: null,
    branchId: 'B1',
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  };
}

function baseInspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: 'insp-1',
    inspectionRef: 'PDI-2026-000001',
    inspectionType: 'DEALER_PDI',
    vehicleId: 'veh-1',
    serial: 'SN-001',
    dealerId: 'D1',
    status: 'InProgress',
    result: null,
    checklistVersion: 'PDI-CL-v1',
    checklist: [{ id: 'engine-oil', category: 'Engine', label: 'Engine oil level', result: 'Pass', remark: null }],
    findings: [],
    measurements: [],
    partsReplaced: [],
    technicianId: null,
    technicianName: 'tech1',
    technicianCertificationRef: null,
    signedOffBy: null,
    signedOffAt: null,
    dealerApprovedBy: null,
    dealerApprovedAt: null,
    relatedNtrId: null,
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
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  } as unknown as InspectionRepository;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InspectionService.completeInspection', () => {
  it('rejects completion while any checklist item has no result', async () => {
    const existing = baseInspection({ checklist: [{ id: 'a', category: 'Engine', label: 'x', result: null, remark: null }] });
    const repo = makeRepo({ getById: vi.fn(() => Promise.resolve(existing)) });
    const service = new InspectionService(repo);

    await expect(service.completeInspection('insp-1', session())).rejects.toThrow(/no result recorded/);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('marks Pass when every checklist item passes and there are no findings', async () => {
    const existing = baseInspection();
    const updated = baseInspection({ status: 'Completed', result: 'Pass' });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      update: vi.fn(() => Promise.resolve(updated)),
    });
    const service = new InspectionService(repo);

    const result = await service.completeInspection('insp-1', session());

    expect(result.result).toBe('Pass');
    expect(repo.update).toHaveBeenCalledWith('insp-1', expect.objectContaining({ status: 'Completed', result: 'Pass' }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ module: 'pdi', eventType: 'StatusChanged', newValue: 'Completed' }));
  });

  it('marks Fail (not silently Pass) when a checklist item fails and a finding was recorded', async () => {
    const existing = baseInspection({
      checklist: [{ id: 'a', category: 'Engine', label: 'x', result: 'Fail', remark: 'leak' }],
      findings: [{ id: 'f1', severity: 'Major', system: 'Engine', description: 'Oil leak', knowledgeCaseId: null }],
    });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      update: vi.fn((_, patch) => Promise.resolve(baseInspection({ status: 'Completed', result: patch.result }))),
    });
    const service = new InspectionService(repo);

    const result = await service.completeInspection('insp-1', session());
    expect(result.result).toBe('Fail');
  });
});

describe('InspectionService.dealerApprove', () => {
  it('throws for DealerUser (only SuperAdmin/CentralAdmin/DealerAdmin may approve)', async () => {
    const repo = makeRepo();
    const service = new InspectionService(repo);

    await expect(service.dealerApprove('insp-1', session({ role: 'DealerUser' }))).rejects.toThrow(/may not give Dealer Approval/);
    expect(repo.getById).not.toHaveBeenCalled();
  });

  it('requires Digital Sign-off to have happened first', async () => {
    const existing = baseInspection({ status: 'Completed', signedOffAt: null });
    const repo = makeRepo({ getById: vi.fn(() => Promise.resolve(existing)) });
    const service = new InspectionService(repo);

    await expect(service.dealerApprove('insp-1', session({ role: 'DealerAdmin' }))).rejects.toThrow(/before Digital Sign-off/);
  });

  it('approves and writes a SystemEvent audit entry when signed off and role is DealerAdmin', async () => {
    const existing = baseInspection({ status: 'Completed', signedOffAt: '2026-01-02T00:00:00Z', signedOffBy: 'tech1' });
    const updated = baseInspection({ dealerApprovedBy: 'admin1', dealerApprovedAt: '2026-01-03T00:00:00Z' });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      update: vi.fn(() => Promise.resolve(updated)),
    });
    const service = new InspectionService(repo);

    const result = await service.dealerApprove('insp-1', session({ role: 'DealerAdmin', username: 'admin1' }));

    expect(result.dealerApprovedBy).toBe('admin1');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ module: 'pdi', eventType: 'SystemEvent', fieldName: 'DealerApproval' }));
  });
});

describe('InspectionService.promoteFindingToKnowledge', () => {
  it('calls KnowledgeService.createCandidate + addEvidence and stores the resulting caseId on the finding - never a duplicate entry form', async () => {
    const existing = baseInspection({
      findings: [{ id: 'f1', severity: 'Major', system: 'Engine', description: 'Oil leak at seal', knowledgeCaseId: null }],
    });
    const updated = baseInspection({
      findings: [{ id: 'f1', severity: 'Major', system: 'Engine', description: 'Oil leak at seal', knowledgeCaseId: 'case-9' }],
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
      findings: [{ id: 'f1', severity: 'Major', system: 'Engine', description: 'Oil leak', knowledgeCaseId: 'case-9' }],
    });
    const repo = makeRepo({ getById: vi.fn(() => Promise.resolve(existing)) });
    const createCandidate = vi.fn();
    const knowledgeService = { createCandidate } as unknown as KnowledgeService;
    const service = new InspectionService(repo, knowledgeService);

    await service.promoteFindingToKnowledge('insp-1', 'f1', session());
    expect(createCandidate).not.toHaveBeenCalled();
  });
});

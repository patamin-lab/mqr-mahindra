import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '@/lib/types';
import type { KnowledgeCase, KnowledgeEvidence } from './types';

const { mockLogAuditEvent, mockLogAuditEvents, mockDiffFieldsForAudit } = vi.hoisted(() => ({
  mockLogAuditEvent: vi.fn(),
  mockLogAuditEvents: vi.fn(),
  mockDiffFieldsForAudit: vi.fn(() => []),
}));

vi.mock('@/lib/db', () => ({
  logAuditEvent: mockLogAuditEvent,
  logAuditEvents: mockLogAuditEvents,
  diffFieldsForAudit: mockDiffFieldsForAudit,
}));

import { KnowledgeService } from './service';
import type { KnowledgeRepository } from './repository';

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

function baseCase(overrides: Partial<KnowledgeCase> = {}): KnowledgeCase {
  return {
    id: 'case-1',
    caseRef: 'KNOW-2026-000001',
    dealerId: 'D1',
    symptom: 'Engine stalls at idle',
    affectedSystem: 'Engine',
    productFamilyId: null,
    model: null,
    possibleCauses: [],
    validatedFix: null,
    verificationSteps: [],
    confidence: 'VeryLow',
    maturity: 'Draft',
    supersededByCaseId: null,
    createdBy: 'alice',
    createdAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00Z',
    recordStatus: 'Active',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<KnowledgeRepository> = {}): KnowledgeRepository {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMaturity: vi.fn(),
    listEvidenceForCase: vi.fn(() => Promise.resolve([])),
    addEvidence: vi.fn(),
    listPublishedCasesForMachineSerial: vi.fn(() => Promise.resolve([])),
    ...overrides,
  } as unknown as KnowledgeRepository;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('KnowledgeService.createCandidate', () => {
  it('creates via the repository and writes a Created audit event (module "knowledge")', async () => {
    const created = baseCase();
    const repo = makeRepo({ create: vi.fn(() => Promise.resolve(created)) });
    const service = new KnowledgeService(repo);

    const result = await service.createCandidate(
      { symptom: 'Engine stalls at idle', affectedSystem: 'Engine', productFamilyId: null, model: null, possibleCauses: [] },
      session()
    );

    expect(result).toEqual(created);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ dealerId: 'D1', createdBy: 'alice' }));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'knowledge', recordId: 'case-1', eventType: 'Created', performedBy: 'alice' })
    );
  });
});

describe('KnowledgeService.transitionMaturity', () => {
  it('throws, and never calls the repository, when the role cannot make this transition', async () => {
    const existing = baseCase({ maturity: 'Review' });
    const repo = makeRepo({ getById: vi.fn(() => Promise.resolve(existing)) });
    const service = new KnowledgeService(repo);

    await expect(service.transitionMaturity('case-1', 'Published', session({ role: 'DealerAdmin' }))).rejects.toThrow(/may not move/);
    expect(repo.updateMaturity).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('updates maturity and writes a StatusChanged audit event when the role is allowed (CentralAdmin publishing)', async () => {
    const existing = baseCase({ maturity: 'Review' });
    const updated = baseCase({ maturity: 'Published' });
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(existing)),
      updateMaturity: vi.fn(() => Promise.resolve(updated)),
    });
    const service = new KnowledgeService(repo);

    const result = await service.transitionMaturity('case-1', 'Published', session({ role: 'CentralAdmin' }));

    expect(result.maturity).toBe('Published');
    expect(repo.updateMaturity).toHaveBeenCalledWith('case-1', 'Published', null, 'alice');
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'knowledge', eventType: 'StatusChanged', fieldName: 'Maturity', oldValue: 'Review', newValue: 'Published' })
    );
  });
});

describe('KnowledgeService.getCase - Related Records derivation', () => {
  it('derives relatedMachines/relatedQualityReports/relatedPm/relatedWarranty from evidence, never a second query', async () => {
    const kase = baseCase();
    const evidence: KnowledgeEvidence[] = [
      {
        id: 'ev-1',
        knowledgeCaseId: 'case-1',
        sourceType: 'Quality',
        sourceModule: 'mqr',
        sourceRecordId: 'QIR-2026-000001',
        machineSerial: 'SN-001',
        author: 'bob',
        observedAt: '2026-01-02',
        confidence: 'Medium',
        summary: 'MQR report matches this symptom',
        createdBy: 'bob',
        createdAt: '2026-01-02T00:00:00Z',
        recordStatus: 'Active',
      },
      {
        id: 'ev-2',
        knowledgeCaseId: 'case-1',
        sourceType: 'Warranty',
        sourceModule: null,
        sourceRecordId: null,
        machineSerial: 'SN-002',
        author: 'carol',
        observedAt: '2026-01-03',
        confidence: null,
        summary: 'Customer reported repeat issue under warranty',
        createdBy: 'carol',
        createdAt: '2026-01-03T00:00:00Z',
        recordStatus: 'Active',
      },
    ];
    const repo = makeRepo({
      getById: vi.fn(() => Promise.resolve(kase)),
      listEvidenceForCase: vi.fn(() => Promise.resolve(evidence)),
    });
    const service = new KnowledgeService(repo);

    const detail = await service.getCase('case-1');

    expect(detail.relatedMachines.sort()).toEqual(['SN-001', 'SN-002']);
    expect(detail.relatedQualityReports).toEqual([{ recordId: 'QIR-2026-000001', href: '/records/QIR-2026-000001' }]);
    expect(detail.relatedPm).toEqual([]);
    expect(detail.relatedWarranty).toHaveLength(1);
    expect(detail.relatedWarranty[0].recordId).toBe('ev-2');
  });
});

describe('KnowledgeService.getKnowledgeForMachine', () => {
  it('maps Published cases from the repository into MachineKnownIssue shapes linking to the detail screen', async () => {
    const repo = makeRepo({
      listPublishedCasesForMachineSerial: vi.fn(() =>
        Promise.resolve([baseCase({ id: 'case-9', caseRef: 'KNOW-2026-000009', maturity: 'Published', confidence: 'High', validatedFix: 'Replace sensor' })])
      ),
    });
    const service = new KnowledgeService(repo);

    const result = await service.getKnowledgeForMachine('SN-001');

    expect(repo.listPublishedCasesForMachineSerial).toHaveBeenCalledWith('SN-001');
    expect(result).toEqual([
      { caseId: 'case-9', caseRef: 'KNOW-2026-000009', symptom: 'Engine stalls at idle', confidence: 'High', validatedFix: 'Replace sensor', href: '/quality/knowledge/case-9' },
    ]);
  });
});

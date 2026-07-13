import { describe, it, expect } from 'vitest';
import { canTransitionKnowledgeMaturity, KNOWLEDGE_MATURITY_TRANSITIONS } from './types';
import type { Role } from '@/lib/types';

describe('canTransitionKnowledgeMaturity (ADR-018, mirrors canTransitionMqrStatus)', () => {
  it('always allows staying on the same maturity (a no-op, matching MQR precedent)', () => {
    expect(canTransitionKnowledgeMaturity('Draft', 'Draft', 'DealerUser')).toBe(true);
    expect(canTransitionKnowledgeMaturity('Published', 'Published', 'DealerUser')).toBe(true);
  });

  it('lets any role submit a Draft Candidate for Review (open to every role, per ch.07)', () => {
    const roles: Role[] = ['SuperAdmin', 'CentralAdmin', 'DealerAdmin', 'DealerUser'];
    for (const role of roles) {
      expect(canTransitionKnowledgeMaturity('Draft', 'Review', role)).toBe(true);
    }
  });

  it('lets any role send a Review candidate back to Draft', () => {
    expect(canTransitionKnowledgeMaturity('Review', 'Draft', 'DealerUser')).toBe(true);
  });

  it('requires canReviewKnowledge (CentralAdmin/SuperAdmin) to publish - DealerAdmin/DealerUser are rejected', () => {
    expect(canTransitionKnowledgeMaturity('Review', 'Published', 'DealerAdmin')).toBe(false);
    expect(canTransitionKnowledgeMaturity('Review', 'Published', 'DealerUser')).toBe(false);
    expect(canTransitionKnowledgeMaturity('Review', 'Published', 'CentralAdmin')).toBe(true);
    expect(canTransitionKnowledgeMaturity('Review', 'Published', 'SuperAdmin')).toBe(true);
  });

  it('requires canReviewKnowledge to deprecate or archive a Published case', () => {
    expect(canTransitionKnowledgeMaturity('Published', 'Deprecated', 'DealerAdmin')).toBe(false);
    expect(canTransitionKnowledgeMaturity('Published', 'Archived', 'DealerAdmin')).toBe(false);
    expect(canTransitionKnowledgeMaturity('Published', 'Deprecated', 'CentralAdmin')).toBe(true);
  });

  it('rejects a transition not in the graph even for an elevated role (e.g. Draft straight to Published)', () => {
    expect(canTransitionKnowledgeMaturity('Draft', 'Published', 'CentralAdmin')).toBe(false);
  });

  it('SuperAdmin gets an unconditional override, matching canTransitionMqrStatus exactly', () => {
    expect(canTransitionKnowledgeMaturity('Draft', 'Published', 'SuperAdmin')).toBe(true);
    expect(canTransitionKnowledgeMaturity('Archived', 'Draft', 'SuperAdmin')).toBe(true);
  });

  it('Archived is terminal in the transition graph for every non-SuperAdmin role', () => {
    expect(KNOWLEDGE_MATURITY_TRANSITIONS.Archived).toEqual([]);
    expect(canTransitionKnowledgeMaturity('Archived', 'Draft', 'CentralAdmin')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { canTransitionMqrStatus, MQR_STATUS_TRANSITIONS, STATUS_VALUES } from '../types';

describe('canTransitionMqrStatus', () => {
  it('always allows staying on the same status, for every role', () => {
    for (const s of STATUS_VALUES) {
      expect(canTransitionMqrStatus(s, s, 'DealerAdmin')).toBe(true);
      expect(canTransitionMqrStatus(s, s, 'CentralAdmin')).toBe(true);
    }
  });

  it('allows a normal-role forward transition defined in the graph', () => {
    expect(canTransitionMqrStatus('Open', 'UnderInvestigation', 'DealerAdmin')).toBe(true);
    expect(canTransitionMqrStatus('UnderInvestigation', 'WaitingParts', 'CentralAdmin')).toBe(true);
    expect(canTransitionMqrStatus('Repaired', 'Closed', 'DealerAdmin')).toBe(true);
  });

  it('rejects a transition not in the graph for a normal role', () => {
    expect(canTransitionMqrStatus('Draft', 'Closed', 'DealerAdmin')).toBe(false);
    expect(canTransitionMqrStatus('Closed', 'Open', 'DealerAdmin')).toBe(false);
    expect(canTransitionMqrStatus('Rejected', 'Open', 'CentralAdmin')).toBe(false);
  });

  it('SuperAdmin may make any transition, including reopening a terminal status', () => {
    expect(canTransitionMqrStatus('Closed', 'Open', 'SuperAdmin')).toBe(true);
    expect(canTransitionMqrStatus('Rejected', 'UnderInvestigation', 'SuperAdmin')).toBe(true);
    expect(canTransitionMqrStatus('Draft', 'Closed', 'SuperAdmin')).toBe(true);
  });

  it('Closed and Rejected are terminal (no outgoing edges) for normal roles', () => {
    expect(MQR_STATUS_TRANSITIONS.Closed).toEqual([]);
    expect(MQR_STATUS_TRANSITIONS.Rejected).toEqual([]);
  });

  it('every non-terminal status has at least one outgoing transition', () => {
    for (const s of STATUS_VALUES) {
      if (s === 'Closed' || s === 'Rejected') continue;
      expect(MQR_STATUS_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });
});

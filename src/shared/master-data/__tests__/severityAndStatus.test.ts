import { describe, it, expect } from 'vitest';
import { MasterDataService } from '../MasterDataService';

describe('Lookup Platform - Severity/Priority and Status facades', () => {
  it('exposes Severity as both severity* and priority* (same lookup, no duplicate vocabulary)', () => {
    expect(MasterDataService.severityValues).toEqual(MasterDataService.priorityValues);
    expect(MasterDataService.severityLabel('Critical')).toBe(MasterDataService.priorityLabel('Critical'));
  });

  it('exposes the MQR status workflow', () => {
    expect(MasterDataService.statusValues).toContain('Open');
    expect(MasterDataService.statusValues).toContain('Closed');
    expect(MasterDataService.openStatusValues).not.toContain('Closed');
    expect(MasterDataService.statusLabel('Open')).toBeTruthy();
  });

  it('enforces MQR status transitions via the shared predicate', () => {
    expect(MasterDataService.canTransitionStatus('Open', 'Closed', 'SuperAdmin')).toBe(true);
  });

  it('exposes the Attachment Type vocabulary from the Attachment Platform', () => {
    expect(MasterDataService.attachmentTypeValues).toContain('CustomerIdCardPhoto');
    expect(MasterDataService.attachmentTypeValues.length).toBeGreaterThan(10);
  });
});

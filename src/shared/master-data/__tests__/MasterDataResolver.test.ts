import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDealers = vi.fn();
const mockGetBranchesForDealer = vi.fn();
const mockGetActiveProductFamilies = vi.fn();
vi.mock('../reference/referenceData', () => ({
  getDealers: () => mockGetDealers(),
  getBranchesForDealer: (dealerId: string | null) => mockGetBranchesForDealer(dealerId),
  getActiveProductFamilies: () => mockGetActiveProductFamilies(),
}));

const { resolveDealer, resolveBranch, resolveProductFamily } = await import('../MasterDataResolver');

const DEALERS = [
  { id: 'KTV', short_name: 'KTV', full_name: 'Khon Tavee', active: true },
  { id: 'SGT', short_name: 'SGT', full_name: 'Siam Great Tractor', active: true },
];

beforeEach(() => {
  mockGetDealers.mockReset().mockResolvedValue(DEALERS);
  mockGetBranchesForDealer.mockReset();
  mockGetActiveProductFamilies.mockReset();
});

describe('resolveDealer', () => {
  it('Tier 1 - resolves by exact ID, regardless of name', async () => {
    const result = await resolveDealer('KTV');
    expect(result).toMatchObject({ ok: true, resolutionMethod: 'id', confidence: 1 });
    expect(result.entity?.id).toBe('KTV');
  });

  it('Tier 2 - resolves by exact name (case/whitespace-insensitive) when the input is not a known ID', async () => {
    const result = await resolveDealer('  siam great tractor  ');
    expect(result).toMatchObject({ ok: true, resolutionMethod: 'exact_name' });
    expect(result.entity?.id).toBe('SGT');
  });

  it('Tier 3 - resolves via a caller-supplied alias map', async () => {
    const result = await resolveDealer('KTV Khon Kaen Branch Office', { 'KTV Khon Kaen Branch Office': 'KTV' });
    expect(result).toMatchObject({ ok: true, resolutionMethod: 'alias' });
    expect(result.entity?.id).toBe('KTV');
  });

  it('Tier 4 - resolves via unique fuzzy match on a near-miss spelling', async () => {
    const result = await resolveDealer('Siam Great Tractr'); // missing an 'o'
    expect(result.ok).toBe(true);
    expect(result.resolutionMethod).toBe('fuzzy');
    expect(result.entity?.id).toBe('SGT');
  });

  it('never guesses between two equally-close fuzzy candidates - reports ambiguous instead', async () => {
    mockGetDealers.mockResolvedValue([
      { id: 'A', short_name: 'A', full_name: 'Krungthep Motors', active: true },
      { id: 'B', short_name: 'B', full_name: 'Krungthep Motor', active: true },
    ]);
    const result = await resolveDealer('Krungthep Motorz');
    expect(result.ok).toBe(false);
    expect(result.resolutionMethod).toBe('ambiguous');
  });

  it('reports not_found for a value matching nothing at any tier', async () => {
    const result = await resolveDealer('Totally Unknown Dealer Name Xyz');
    expect(result.ok).toBe(false);
    expect(result.resolutionMethod).toBe('not_found');
  });

  it('never creates Master Data - only ever returns an existing entity or null', async () => {
    const result = await resolveDealer('Nonexistent Co Ltd');
    expect(result.entity).toBeNull();
    expect(mockGetDealers).toHaveBeenCalledTimes(1);
  });
});

describe('resolveBranch / resolveProductFamily', () => {
  it('resolveBranch scopes to the given dealerId', async () => {
    mockGetBranchesForDealer.mockResolvedValue([{ id: 'B1', name: 'Khon Kaen', dealer_id: 'KTV', active: true }]);
    const result = await resolveBranch('KTV', 'Khon Kaen');
    expect(mockGetBranchesForDealer).toHaveBeenCalledWith('KTV');
    expect(result.entity?.id).toBe('B1');
  });

  it('resolveProductFamily resolves by exact name', async () => {
    mockGetActiveProductFamilies.mockResolvedValue([{ id: 'PF1', code: 'X', name: 'Compact Tractor', active: true }]);
    const result = await resolveProductFamily('Compact Tractor');
    expect(result).toMatchObject({ ok: true, resolutionMethod: 'exact_name' });
  });
});

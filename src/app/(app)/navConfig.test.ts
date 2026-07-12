import { describe, it, expect } from 'vitest';
import { getNavGroups, flattenRealNavItems, findActiveNavItem } from './navConfig';
import type { SessionUser } from '@/lib/types';

const t = (key: string) => key;

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    username: 'x',
    fullName: 'X',
    role: 'DealerUser',
    dealerId: 'D1',
    branch: null,
    branchId: 'B1',
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  };
}

describe('getNavGroups (MSEAL Design Framework, ADR-023, Navigation Standard)', () => {
  it('always includes the Dashboard group with a single real Platform Overview item', () => {
    const groups = getNavGroups(t, session());
    const dashboard = groups.find((g) => g.key === 'dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard!.items).toEqual([{ href: '/dashboard', label: 'nav.platformOverview' }]);
  });

  it('marks not-yet-built leaves as Coming Soon with a null href, never a fake route', () => {
    const groups = getNavGroups(t, session());
    const machines = groups.find((g) => g.key === 'machines')!;
    const passport = machines.items!.find((i) => i.label === 'nav.machinePassport');
    expect(passport).toEqual({ href: null, icon: undefined, label: 'nav.machinePassport', comingSoon: true });
  });

  it('hides Legacy Import (Machines group) from every role except SuperAdmin', () => {
    const dealerAdmin = getNavGroups(t, session({ role: 'DealerAdmin' }));
    const superAdmin = getNavGroups(t, session({ role: 'SuperAdmin', dealerId: null, branchId: null }));

    const machinesForDealerAdmin = dealerAdmin.find((g) => g.key === 'machines')!;
    expect(machinesForDealerAdmin.items!.some((i) => i.href === '/admin/legacy-import')).toBe(false);

    const machinesForSuperAdmin = superAdmin.find((g) => g.key === 'machines')!;
    expect(machinesForSuperAdmin.items!.some((i) => i.href === '/admin/legacy-import')).toBe(true);
  });

  it('omits the Administration group entirely for a role with zero visible admin items (DealerUser)', () => {
    const groups = getNavGroups(t, session({ role: 'DealerUser' }));
    expect(groups.find((g) => g.key === 'administration')).toBeUndefined();
  });

  it('shows Administration > Import History only to SuperAdmin, alongside Users for every non-DealerUser role', () => {
    const dealerAdmin = getNavGroups(t, session({ role: 'DealerAdmin' })).find((g) => g.key === 'administration');
    expect(dealerAdmin).toBeDefined();
    expect(dealerAdmin!.items!.some((i) => i.href === '/admin/users')).toBe(true);
    expect(dealerAdmin!.items!.some((i) => i.href === '/admin/import-history')).toBe(false);

    const superAdmin = getNavGroups(t, session({ role: 'SuperAdmin', dealerId: null, branchId: null })).find(
      (g) => g.key === 'administration'
    );
    expect(superAdmin!.items!.some((i) => i.href === '/admin/import-history')).toBe(true);
  });

  it('nests Master Data as an Administration subgroup, gated the same as before (canManageMasterData)', () => {
    const superAdmin = getNavGroups(t, session({ role: 'SuperAdmin', dealerId: null, branchId: null })).find(
      (g) => g.key === 'administration'
    )!;
    expect(superAdmin.subgroups).toBeDefined();
    expect(superAdmin.subgroups![0].items.some((i) => i.href === '/admin/dealers')).toBe(true);
  });

  it('every Group with items has a unique key (no accidental duplicate groups)', () => {
    const keys = getNavGroups(t, session({ role: 'SuperAdmin', dealerId: null, branchId: null })).map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('PIP (pre-merge refinement) lives under Engineering Intelligence, not Quality - exactly one Quality-adjacent copy removed, not duplicated', () => {
    const groups = getNavGroups(t, session());
    const quality = groups.find((g) => g.key === 'quality')!;
    const engineeringIntelligence = groups.find((g) => g.key === 'engineering-intelligence')!;

    expect(quality.items!.some((i) => i.label === 'nav.pip')).toBe(false);
    expect(engineeringIntelligence.items!.some((i) => i.label === 'nav.pip' && i.comingSoon)).toBe(true);
  });

  it('Service > Campaigns keeps its own PIP entry unchanged (a different reference, not a duplicate page - both Coming Soon)', () => {
    const groups = getNavGroups(t, session());
    const service = groups.find((g) => g.key === 'service')!;
    const campaigns = service.subgroups!.find((s) => s.label === 'nav.campaigns')!;
    expect(campaigns.items.some((i) => i.label === 'nav.pip' && i.comingSoon)).toBe(true);
  });

  it('Engineering Intelligence includes a Coming Soon Troubleshooting entry', () => {
    const groups = getNavGroups(t, session());
    const engineeringIntelligence = groups.find((g) => g.key === 'engineering-intelligence')!;
    expect(engineeringIntelligence.items).toEqual([
      { href: null, icon: undefined, label: 'nav.knowledgeEngine', comingSoon: true },
      { href: null, icon: undefined, label: 'nav.troubleshooting', comingSoon: true },
      { href: null, icon: undefined, label: 'nav.aiAnalysis', comingSoon: true },
      { href: null, icon: undefined, label: 'nav.prediction', comingSoon: true },
      { href: null, icon: undefined, label: 'nav.pip', comingSoon: true },
      { href: null, icon: undefined, label: 'nav.insights', comingSoon: true },
    ]);
  });
});

describe('flattenRealNavItems / findActiveNavItem', () => {
  it('flattens only real (non-Coming-Soon) leaves across groups and subgroups', () => {
    const groups = getNavGroups(t, session({ role: 'SuperAdmin', dealerId: null, branchId: null }));
    const flat = flattenRealNavItems(groups);
    expect(flat.every((i) => !!i.href)).toBe(true);
    expect(flat.some((i) => i.href === '/vehicles')).toBe(true);
    expect(flat.some((i) => i.href === '/admin/dealers')).toBe(true);
  });

  it('finds the active item by pathname prefix, ignoring Coming Soon leaves entirely', () => {
    const groups = getNavGroups(t, session({ role: 'SuperAdmin', dealerId: null, branchId: null }));
    const flat = flattenRealNavItems(groups);
    const active = findActiveNavItem('/vehicles/ABC123', flat);
    expect(active?.href).toBe('/vehicles');
  });

  it('returns null for a pathname matching no real route', () => {
    const groups = getNavGroups(t, session());
    const flat = flattenRealNavItems(groups);
    expect(findActiveNavItem('/some-unmapped-path', flat)).toBeNull();
  });
});

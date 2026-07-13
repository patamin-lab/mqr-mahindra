import { describe, it, expect } from 'vitest';
import { getNavGroups, flattenRealNavItems, findActiveNavItem, effectiveStatus, isCapabilityVisible } from './navConfig';
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

const superAdmin = () => session({ role: 'SuperAdmin', dealerId: null, branchId: null });

describe('getNavGroups (MSEAL Design Framework, ADR-023, Navigation Standard)', () => {
  it('always includes the Dashboard group with a single real Platform Overview item', () => {
    const groups = getNavGroups(t, session());
    const dashboard = groups.find((g) => g.key === 'dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard!.items).toEqual([{ href: '/dashboard', label: 'nav.platformOverview' }]);
  });

  it('marks not-yet-built leaves as Coming Soon with a null href, never a fake route (visible to SuperAdmin)', () => {
    const groups = getNavGroups(t, superAdmin());
    const service = groups.find((g) => g.key === 'service')!;
    const warranty = service.items!.find((i) => i.label === 'nav.warranty');
    expect(warranty).toEqual({ href: null, icon: undefined, label: 'nav.warranty', comingSoon: true });
  });

  it('activates Machine Passport as a real route (Machine Digital Passport v1.0) - no longer Coming Soon', () => {
    const groups = getNavGroups(t, session());
    const machines = groups.find((g) => g.key === 'machines')!;
    const passport = machines.items!.find((i) => i.label === 'nav.machinePassport');
    expect(passport).toEqual({ href: '/machines', label: 'nav.machinePassport' });
  });

  it('hides Legacy Import (Machines group) from every role except SuperAdmin', () => {
    const dealerAdmin = getNavGroups(t, session({ role: 'DealerAdmin' }));
    const superAdminGroups = getNavGroups(t, superAdmin());

    const machinesForDealerAdmin = dealerAdmin.find((g) => g.key === 'machines')!;
    expect(machinesForDealerAdmin.items!.some((i) => i.href === '/admin/legacy-import')).toBe(false);

    const machinesForSuperAdmin = superAdminGroups.find((g) => g.key === 'machines')!;
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

    const superAdminGroups = getNavGroups(t, superAdmin()).find((g) => g.key === 'administration');
    expect(superAdminGroups!.items!.some((i) => i.href === '/admin/import-history')).toBe(true);
  });

  it('nests Master Data as an Administration subgroup, gated the same as before (canManageMasterData)', () => {
    const superAdminGroups = getNavGroups(t, superAdmin()).find((g) => g.key === 'administration')!;
    expect(superAdminGroups.subgroups).toBeDefined();
    expect(superAdminGroups.subgroups![0].items.some((i) => i.href === '/admin/dealers')).toBe(true);
  });

  it('every Group with items has a unique key (no accidental duplicate groups)', () => {
    const keys = getNavGroups(t, superAdmin()).map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('PIP (pre-merge refinement) lives under Engineering Intelligence, not Quality - exactly one Quality-adjacent copy removed, not duplicated', () => {
    const groups = getNavGroups(t, superAdmin());
    const quality = groups.find((g) => g.key === 'quality')!;
    const engineeringIntelligence = groups.find((g) => g.key === 'engineering-intelligence')!;

    expect(quality.items!.some((i) => i.label === 'nav.pip')).toBe(false);
    expect(engineeringIntelligence.items!.some((i) => i.label === 'nav.pip' && i.comingSoon)).toBe(true);
  });

  it('Service > Campaigns keeps its own PIP entry unchanged (a different reference, not a duplicate page - both Coming Soon)', () => {
    const groups = getNavGroups(t, superAdmin());
    const service = groups.find((g) => g.key === 'service')!;
    const campaigns = service.subgroups!.find((s) => s.label === 'nav.campaigns')!;
    expect(campaigns.items.some((i) => i.label === 'nav.pip' && i.comingSoon)).toBe(true);
  });

  it('Engineering Intelligence exposes only AI Engineering, PIP, and Predictive Quality - no Knowledge Engine or Troubleshooting entry (owned by Quality instead)', () => {
    const groups = getNavGroups(t, superAdmin());
    const engineeringIntelligence = groups.find((g) => g.key === 'engineering-intelligence')!;
    expect(engineeringIntelligence.items).toEqual([
      { href: null, icon: undefined, label: 'nav.aiAnalysis', comingSoon: true },
      { href: null, icon: undefined, label: 'nav.pip', comingSoon: true },
      { href: null, icon: undefined, label: 'nav.prediction', comingSoon: true },
    ]);
    expect(engineeringIntelligence.items!.some((i) => i.label === 'nav.knowledgeEngine')).toBe(false);
    expect(engineeringIntelligence.items!.some((i) => i.label === 'nav.troubleshooting')).toBe(false);
    expect(engineeringIntelligence.items!.some((i) => i.label === 'nav.insights')).toBe(false);
  });

  it('Quality owns exactly one Troubleshooting entry (execution), not duplicated under Engineering Intelligence (analysis)', () => {
    const groups = getNavGroups(t, superAdmin());
    const quality = groups.find((g) => g.key === 'quality')!;
    const engineeringIntelligence = groups.find((g) => g.key === 'engineering-intelligence')!;

    expect(quality.items!.some((i) => i.label === 'nav.troubleshooting' && i.comingSoon)).toBe(true);
    expect(engineeringIntelligence.items!.some((i) => i.label === 'nav.troubleshooting')).toBe(false);
  });

  it('Service > Campaigns no longer includes Recall (removed - no Recall module/data exists)', () => {
    const groups = getNavGroups(t, superAdmin());
    const service = groups.find((g) => g.key === 'service')!;
    const campaigns = service.subgroups!.find((s) => s.label === 'nav.campaigns')!;
    expect(campaigns.items.some((i) => i.label === 'nav.recall')).toBe(false);
  });

  it('Knowledge (Engineering Knowledge Platform, ADR-018) is now a real route under Quality - same label, same position, no longer Coming Soon', () => {
    const groups = getNavGroups(t, session());
    const quality = groups.find((g) => g.key === 'quality')!;
    expect(quality.items).toEqual([
      { href: '/quality/dashboard', label: 'nav.qualityDashboard' },
      { href: '/records', label: 'nav.qualityCases' },
      { href: null, icon: undefined, label: 'nav.qualityAnalytics', comingSoon: true },
      { href: null, icon: undefined, label: 'nav.troubleshooting', comingSoon: true },
      { href: '/quality/knowledge', label: 'nav.qualityKnowledge' },
    ]);
  });
});

describe('Navigation Visibility Rule (capability status + authorization, post-Foundation Freeze)', () => {
  it('effectiveStatus derives ACTIVE for a real route and COMING_SOON for a comingSoon placeholder, with an explicit status override winning over both', () => {
    expect(effectiveStatus({ href: '/x', label: 'L' })).toBe('ACTIVE');
    expect(effectiveStatus({ href: null, label: 'L', comingSoon: true })).toBe('COMING_SOON');
    expect(effectiveStatus({ href: null, label: 'L', comingSoon: true, status: 'PREVIEW' })).toBe('PREVIEW');
  });

  it('isCapabilityVisible: SuperAdmin sees every capability status; every other role sees only ACTIVE', () => {
    const comingSoonItem = { href: null, label: 'L', comingSoon: true } as const;
    const activeItem = { href: '/x', label: 'L' } as const;

    expect(isCapabilityVisible(activeItem, 'DealerUser')).toBe(true);
    expect(isCapabilityVisible(comingSoonItem, 'DealerUser')).toBe(false);
    expect(isCapabilityVisible(comingSoonItem, 'DealerAdmin')).toBe(false);
    expect(isCapabilityVisible(comingSoonItem, 'CentralAdmin')).toBe(false);
    expect(isCapabilityVisible(comingSoonItem, 'SuperAdmin')).toBe(true);
  });

  it('hides every unfinished (non-ACTIVE) leaf completely for DealerUser, DealerAdmin, and CentralAdmin - never rendered as a disabled placeholder', () => {
    for (const role of ['DealerUser', 'DealerAdmin', 'CentralAdmin'] as const) {
      const groups = getNavGroups(t, session({ role, dealerId: role === 'CentralAdmin' ? null : 'D1' }));
      for (const group of groups) {
        for (const item of group.items ?? []) {
          expect(item.comingSoon).not.toBe(true);
        }
        for (const sub of group.subgroups ?? []) {
          for (const item of sub.items) {
            expect(item.comingSoon).not.toBe(true);
          }
        }
      }
    }
  });

  it('SuperAdmin still sees every Coming Soon placeholder, unchanged from before this refinement', () => {
    const groups = getNavGroups(t, superAdmin());
    const comingSoonCount = groups
      .flatMap((g) => [...(g.items ?? []), ...(g.subgroups ?? []).flatMap((s) => s.items)])
      .filter((i) => i.comingSoon).length;
    expect(comingSoonCount).toBeGreaterThan(0);
  });

  it('a group whose every item is a non-ACTIVE capability is hidden entirely for non-SuperAdmin - Engineering Intelligence (all 3 items Coming Soon)', () => {
    const groups = getNavGroups(t, session({ role: 'DealerAdmin' }));
    expect(groups.find((g) => g.key === 'engineering-intelligence')).toBeUndefined();

    const superAdminGroups = getNavGroups(t, superAdmin());
    expect(superAdminGroups.find((g) => g.key === 'engineering-intelligence')).toBeDefined();
  });

  it('a group whose every item is a non-ACTIVE capability is hidden entirely for non-SuperAdmin - Reports (all 4 items Coming Soon)', () => {
    const groups = getNavGroups(t, session({ role: 'CentralAdmin', dealerId: null }));
    expect(groups.find((g) => g.key === 'reports')).toBeUndefined();

    const superAdminGroups = getNavGroups(t, superAdmin());
    expect(superAdminGroups.find((g) => g.key === 'reports')).toBeDefined();
  });

  it('this is a generic status-driven rule, not a per-module special case - every remaining group for a non-SuperAdmin role has at least one ACTIVE leaf', () => {
    const groups = getNavGroups(t, session({ role: 'DealerUser' }));
    for (const group of groups) {
      const items = group.items ?? [];
      const subItems = (group.subgroups ?? []).flatMap((s) => s.items);
      expect(items.length + subItems.length).toBeGreaterThan(0);
    }
  });

  it('Service keeps its real PM Records item but hides Warranty and the entire Campaigns subgroup (both fully Coming Soon) for non-SuperAdmin', () => {
    const groups = getNavGroups(t, session({ role: 'DealerAdmin' }));
    const service = groups.find((g) => g.key === 'service')!;
    expect(service.items).toEqual([{ href: '/pm-records', label: 'nav.pmRecords' }]);
    expect(service.subgroups).toBeUndefined();
  });

  it('Quality keeps its two real items but hides Analytics/Troubleshooting/Knowledge (all Coming Soon) for non-SuperAdmin', () => {
    const groups = getNavGroups(t, session({ role: 'DealerUser' }));
    const quality = groups.find((g) => g.key === 'quality')!;
    expect(quality.items).toEqual([
      { href: '/quality/dashboard', label: 'nav.qualityDashboard' },
      { href: '/records', label: 'nav.qualityCases' },
    ]);
  });

  it('Administration hides Audit/Sessions/Settings (Coming Soon) from DealerAdmin/CentralAdmin but keeps them for SuperAdmin', () => {
    const dealerAdmin = getNavGroups(t, session({ role: 'DealerAdmin' })).find((g) => g.key === 'administration')!;
    expect(dealerAdmin.items!.some((i) => i.label === 'nav.adminAudit')).toBe(false);
    expect(dealerAdmin.items!.some((i) => i.label === 'nav.adminSessions')).toBe(false);
    expect(dealerAdmin.items!.some((i) => i.label === 'nav.adminSettings')).toBe(false);
    expect(dealerAdmin.items!.some((i) => i.href === '/admin/users')).toBe(true);

    const superAdminGroups = getNavGroups(t, superAdmin()).find((g) => g.key === 'administration')!;
    expect(superAdminGroups.items!.some((i) => i.label === 'nav.adminAudit')).toBe(true);
    expect(superAdminGroups.items!.some((i) => i.label === 'nav.adminSessions')).toBe(true);
    expect(superAdminGroups.items!.some((i) => i.label === 'nav.adminSettings')).toBe(true);
  });
});

describe('flattenRealNavItems / findActiveNavItem', () => {
  it('flattens only real (non-Coming-Soon) leaves across groups and subgroups', () => {
    const groups = getNavGroups(t, superAdmin());
    const flat = flattenRealNavItems(groups);
    expect(flat.every((i) => !!i.href)).toBe(true);
    expect(flat.some((i) => i.href === '/vehicles')).toBe(true);
    expect(flat.some((i) => i.href === '/admin/dealers')).toBe(true);
  });

  it('finds the active item by pathname prefix, ignoring Coming Soon leaves entirely', () => {
    const groups = getNavGroups(t, superAdmin());
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

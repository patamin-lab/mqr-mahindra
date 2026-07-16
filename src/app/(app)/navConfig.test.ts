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

describe('getNavGroups (Business Workflow Consolidation, ADR-035/036/037 - lifecycle-ordered, Production Pilot)', () => {
  it('always includes the Dashboard group with a single real Platform Overview item', () => {
    const groups = getNavGroups(t, session());
    const dashboard = groups.find((g) => g.key === 'dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard!.items).toEqual([{ href: '/dashboard', label: 'nav.platformOverview' }]);
  });

  it('Vehicle Lookup is its own top-level group (not nested under a lifecycle stage) with exactly one item, Vehicle 360', () => {
    const groups = getNavGroups(t, session());
    const vehicleLookup = groups.find((g) => g.key === 'vehicleLookup')!;
    expect(vehicleLookup).toBeDefined();
    expect(vehicleLookup.items).toEqual([{ href: '/machines', label: 'nav.vehicle360' }]);
  });

  it('Vehicle 360 consolidation (ADR-030): one nav entry at /machines, no separate /vehicles entry', () => {
    const groups = getNavGroups(t, session());
    const vehicleLookup = groups.find((g) => g.key === 'vehicleLookup')!;
    expect(vehicleLookup.items!.some((i) => i.href === '/vehicles')).toBe(false);
  });

  it('New Tractor Delivery (NTR) lives under Delivery Lifecycle, not Vehicle Lookup - a workflow step, not the persistent lookup', () => {
    const groups = getNavGroups(t, session());
    const deliveryLifecycle = groups.find((g) => g.key === 'deliveryLifecycle')!;
    expect(deliveryLifecycle).toBeDefined();
    expect(deliveryLifecycle.items).toEqual([{ href: '/ntr', label: 'nav.ntrRecords' }]);

    const vehicleLookup = groups.find((g) => g.key === 'vehicleLookup')!;
    expect(vehicleLookup.items!.some((i) => i.href === '/ntr')).toBe(false);
  });

  it('Historical NTR Import (formerly Legacy Import) and Import History have no nav entry for any role, including SuperAdmin - permanently retired (ADR-038)', () => {
    const dealerAdmin = getNavGroups(t, session({ role: 'DealerAdmin' }));
    const superAdminGroups = getNavGroups(t, superAdmin());

    const flatDealer = flattenRealNavItems(dealerAdmin);
    const flatSuperAdmin = flattenRealNavItems(superAdminGroups);
    expect(flatDealer.some((i) => i.href === '/admin/legacy-import')).toBe(false);
    expect(flatSuperAdmin.some((i) => i.href === '/admin/legacy-import')).toBe(false);
    expect(flatDealer.some((i) => i.href === '/admin/import-history')).toBe(false);
    expect(flatSuperAdmin.some((i) => i.href === '/admin/import-history')).toBe(false);
  });

  it('omits the Administration group entirely for a role with zero visible admin items (DealerUser)', () => {
    const groups = getNavGroups(t, session({ role: 'DealerUser' }));
    expect(groups.find((g) => g.key === 'administration')).toBeUndefined();
  });

  it('shows Administration > Users for every non-DealerUser role', () => {
    const dealerAdmin = getNavGroups(t, session({ role: 'DealerAdmin' })).find((g) => g.key === 'administration');
    expect(dealerAdmin).toBeDefined();
    expect(dealerAdmin!.items!.some((i) => i.href === '/admin/users')).toBe(true);
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

  it('Quality owns exactly one Quality Cases (MQR) entry and Knowledge - no Troubleshooting/Analytics placeholder scaffolded (Production Pilot hides them regardless of role)', () => {
    const groups = getNavGroups(t, superAdmin());
    const quality = groups.find((g) => g.key === 'quality')!;
    expect(quality.items).toEqual([
      { href: '/quality/dashboard', label: 'nav.qualityDashboard' },
      { href: '/records', label: 'nav.qualityCases' },
      { href: '/quality/knowledge', label: 'nav.qualityKnowledge' },
    ]);
  });

  it('Engineering Intelligence and Reports groups do not exist at all - both were 100% not-yet-built capabilities', () => {
    const groups = getNavGroups(t, superAdmin());
    expect(groups.find((g) => g.key === 'engineering-intelligence')).toBeUndefined();
    expect(groups.find((g) => g.key === 'reports')).toBeUndefined();
  });

  it('Service keeps only its real PM Records item - Warranty and the Campaigns subgroup (both 100% not-yet-built) do not exist', () => {
    const groups = getNavGroups(t, superAdmin());
    const service = groups.find((g) => g.key === 'service')!;
    expect(service.items).toEqual([{ href: '/pm-records', label: 'nav.pmRecords' }]);
    expect(service.subgroups).toBeUndefined();
  });

  it('Knowledge (Engineering Knowledge Platform, ADR-018) is a real route under Quality for every role', () => {
    const groups = getNavGroups(t, session());
    const quality = groups.find((g) => g.key === 'quality')!;
    expect(quality.items!.some((i) => i.href === '/quality/knowledge')).toBe(true);
  });
});

describe('Navigation Visibility Rule (Production Pilot: Coming Soon hidden for every role, including SuperAdmin)', () => {
  it('effectiveStatus derives ACTIVE for a real route and COMING_SOON for a comingSoon placeholder, with an explicit status override winning over both', () => {
    expect(effectiveStatus({ href: '/x', label: 'L' })).toBe('ACTIVE');
    expect(effectiveStatus({ href: null, label: 'L', comingSoon: true })).toBe('COMING_SOON');
    expect(effectiveStatus({ href: null, label: 'L', comingSoon: true, status: 'PREVIEW' })).toBe('PREVIEW');
  });

  it('isCapabilityVisible: only ACTIVE is visible, for every role including SuperAdmin (Production Pilot policy)', () => {
    const comingSoonItem = { href: null, label: 'L', comingSoon: true } as const;
    const activeItem = { href: '/x', label: 'L' } as const;

    expect(isCapabilityVisible(activeItem, 'DealerUser')).toBe(true);
    expect(isCapabilityVisible(comingSoonItem, 'DealerUser')).toBe(false);
    expect(isCapabilityVisible(comingSoonItem, 'DealerAdmin')).toBe(false);
    expect(isCapabilityVisible(comingSoonItem, 'CentralAdmin')).toBe(false);
    expect(isCapabilityVisible(comingSoonItem, 'SuperAdmin')).toBe(false);
  });

  it('no Coming Soon leaf appears anywhere in the nav tree, for any role, including SuperAdmin', () => {
    for (const role of ['DealerUser', 'DealerAdmin', 'CentralAdmin', 'SuperAdmin'] as const) {
      const groups = getNavGroups(t, session({ role, dealerId: role === 'CentralAdmin' || role === 'SuperAdmin' ? null : 'D1' }));
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

  it('this is a generic status-driven rule, not a per-module special case - every remaining group for any role has at least one ACTIVE leaf', () => {
    for (const role of ['DealerUser', 'DealerAdmin', 'CentralAdmin', 'SuperAdmin'] as const) {
      const groups = getNavGroups(t, session({ role, dealerId: role === 'CentralAdmin' || role === 'SuperAdmin' ? null : 'D1' }));
      for (const group of groups) {
        const items = group.items ?? [];
        const subItems = (group.subgroups ?? []).flatMap((s) => s.items);
        expect(items.length + subItems.length).toBeGreaterThan(0);
      }
    }
  });

  it('Administration hides Audit/Sessions/Settings for every role, including SuperAdmin - none are scaffolded at all', () => {
    const superAdminGroups = getNavGroups(t, superAdmin()).find((g) => g.key === 'administration')!;
    expect(superAdminGroups.items!.some((i) => i.label === 'nav.adminAudit')).toBe(false);
    expect(superAdminGroups.items!.some((i) => i.label === 'nav.adminSessions')).toBe(false);
    expect(superAdminGroups.items!.some((i) => i.label === 'nav.adminSettings')).toBe(false);
    expect(superAdminGroups.items!.some((i) => i.href === '/admin/users')).toBe(true);
  });
});

describe('flattenRealNavItems / findActiveNavItem', () => {
  it('flattens only real (non-Coming-Soon) leaves across groups and subgroups', () => {
    const groups = getNavGroups(t, superAdmin());
    const flat = flattenRealNavItems(groups);
    expect(flat.every((i) => !!i.href)).toBe(true);
    expect(flat.some((i) => i.href === '/machines')).toBe(true);
    expect(flat.some((i) => i.href === '/admin/dealers')).toBe(true);
  });

  it('finds the active item by pathname prefix, ignoring Coming Soon leaves entirely', () => {
    const groups = getNavGroups(t, superAdmin());
    const flat = flattenRealNavItems(groups);
    const active = findActiveNavItem('/machines/ABC123', flat);
    expect(active?.href).toBe('/machines');
  });

  it('returns null for a pathname matching no real route', () => {
    const groups = getNavGroups(t, session());
    const flat = flattenRealNavItems(groups);
    expect(findActiveNavItem('/some-unmapped-path', flat)).toBeNull();
  });

  it('Import & Inspection (Dashboard + Import Inspection) belongs exclusively to MSEAL (business-domain correction) - the whole group is hidden from Dealer roles', () => {
    const dealerGroups = getNavGroups(t, session({ role: 'DealerUser' }));
    expect(dealerGroups.find((g) => g.key === 'qualityInspection')).toBeUndefined();

    const superAdminGroups = getNavGroups(t, superAdmin());
    const importInspection = superAdminGroups.find((g) => g.key === 'qualityInspection')!;
    expect(importInspection).toBeDefined();
    expect(importInspection.label).toBe('nav.importInspectionGroup');
    expect(importInspection.items).toEqual([
      { href: '/delivery/pdi/dashboard', label: 'nav.qualityInspectionDashboard' },
      { href: '/delivery/pdi', label: 'nav.qualityInspectionImport' },
    ]);
  });
});

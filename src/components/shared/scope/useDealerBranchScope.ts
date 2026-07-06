'use client';

/**
 * DealerBranchScope — Platform Standard (client side).
 *
 * The one shared hook every module's dealer/branch filter UI consumes,
 * replacing the ad hoc `dealerId`/`branchId` state + `useEffect` refetch of
 * `/api/branches?dealerId=` pattern previously hand-duplicated in
 * `ntr-search.tsx`, `maintenance-search.tsx`, `report-form.tsx`.
 *
 * Role behavior (never overridable by a bug in a calling component -
 * `changeDealer`/`changeBranch` are true no-ops for pinned roles, not just
 * UI-disabled):
 * - SuperAdmin/CentralAdmin: may switch dealer; changing dealer always
 *   clears branch back to "All" and loads that dealer's branches.
 * - DealerAdmin: dealer is pinned to session; may switch branch within it.
 * - DealerUser: both dealer and branch are pinned to session.
 *
 * Branches are never preloaded for every dealer - only fetched once a
 * dealer is known (session-pinned, or explicitly chosen), and cached per
 * dealer in a plain `Map` (no new dependency) so switching back to a
 * previously-selected dealer never refetches.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dealer, Branch, Role } from '@/lib/types';

export interface UseDealerBranchScopeArgs {
  role: Role;
  sessionDealerId: string | null;
  sessionBranchId: string | null;
  /** SuperAdmin/CentralAdmin only - the full dealer list to choose from.
   *  Pass `[]` for a pinned role (nothing to pick). */
  initialDealers: Dealer[];
  /** Restore a prior selection (e.g. from `searchParams`). */
  initialDealerId?: string | null;
  initialBranchId?: string | null;
}

export interface UseDealerBranchScopeResult {
  currentDealer: Dealer | null;
  currentBranch: Branch | null;
  availableDealers: Dealer[];
  availableBranches: Branch[];
  loadingBranches: boolean;
  /** Render-time metadata beyond the platform standard's minimum surface -
   *  lets a shared UI component (`DealerBranchSelector`) render the correct
   *  variant without fragile inference from `availableDealers`/
   *  `availableBranches` being empty (which can also happen transiently,
   *  e.g. before a fetch resolves, or legitimately, e.g. a dealer with no
   *  branches yet). */
  isDealerPinned: boolean;
  isBranchPinned: boolean;
  changeDealer: (dealerId: string | null) => Promise<void>;
  changeBranch: (branchId: string | null) => void;
  resetBranch: () => void;
  canAccessDealer: (dealerId: string) => boolean;
  canAccessBranch: (branchId: string) => boolean;
}

export function useDealerBranchScope(args: UseDealerBranchScopeArgs): UseDealerBranchScopeResult {
  const { role, sessionDealerId, sessionBranchId, initialDealers } = args;
  const isDealerPinned = role !== 'SuperAdmin' && role !== 'CentralAdmin';
  const isBranchPinned = role === 'DealerUser';

  const [dealerId, setDealerId] = useState<string | null>(isDealerPinned ? sessionDealerId : args.initialDealerId ?? null);
  const [branchId, setBranchId] = useState<string | null>(isBranchPinned ? sessionBranchId : args.initialBranchId ?? null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Per-dealer cache: a dealer switched back to never triggers a refetch.
  const cacheRef = useRef<Map<string, Branch[]>>(new Map());

  const fetchBranches = useCallback(async (forDealerId: string | null) => {
    if (!forDealerId) {
      setBranches([]);
      return;
    }
    const cached = cacheRef.current.get(forDealerId);
    if (cached) {
      setBranches(cached);
      return;
    }
    setLoadingBranches(true);
    try {
      const res = await fetch(`/api/branches?dealerId=${encodeURIComponent(forDealerId)}`);
      const json = await res.json();
      const list: Branch[] = json.branches ?? [];
      cacheRef.current.set(forDealerId, list);
      setBranches(list);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  // Load branches once for whichever dealer is already known on mount
  // (session-pinned dealer, or a restored `initialDealerId`) - never for
  // every dealer up front. Intentionally `[]`-deps: only the true initial
  // dealer should trigger this; every subsequent change goes through
  // `changeDealer`, which already fetches.
  useEffect(() => {
    if (dealerId) void fetchBranches(dealerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeDealer = useCallback(
    async (newDealerId: string | null) => {
      if (isDealerPinned) return;
      setDealerId(newDealerId);
      setBranchId(null); // dealer change always clears branch back to "All"
      await fetchBranches(newDealerId);
    },
    [isDealerPinned, fetchBranches]
  );

  const changeBranch = useCallback(
    (newBranchId: string | null) => {
      if (isBranchPinned) return;
      setBranchId(newBranchId);
    },
    [isBranchPinned]
  );

  const resetBranch = useCallback(() => {
    if (isBranchPinned) return;
    setBranchId(null);
  }, [isBranchPinned]);

  const canAccessDealer = useCallback((id: string) => (isDealerPinned ? id === sessionDealerId : true), [isDealerPinned, sessionDealerId]);
  const canAccessBranch = useCallback((id: string) => (isBranchPinned ? id === sessionBranchId : true), [isBranchPinned, sessionBranchId]);

  const currentDealer = useMemo(() => initialDealers.find((d) => d.id === dealerId) ?? null, [initialDealers, dealerId]);
  const currentBranch = useMemo(() => branches.find((b) => b.id === branchId) ?? null, [branches, branchId]);

  return {
    currentDealer,
    currentBranch,
    availableDealers: isDealerPinned ? [] : initialDealers,
    availableBranches: branches,
    loadingBranches,
    isDealerPinned,
    isBranchPinned,
    changeDealer,
    changeBranch,
    resetBranch,
    canAccessDealer,
    canAccessBranch,
  };
}

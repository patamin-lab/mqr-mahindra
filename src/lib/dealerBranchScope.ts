/**
 * DealerBranchScope — Platform Standard (server side).
 *
 * The third leg alongside `scope.ts` (role predicates) and `db.ts` (query
 * execution): resolves *which* dealer_id/branch_id a request may run
 * against, and validates that a branch actually belongs to a dealer.
 * Every module's API routes and repositories should resolve scope through
 * these functions rather than re-deriving the "zero-leakage" dealer/branch
 * pattern inline (previously duplicated across `records`/`ntr-records`/
 * `pm-records` routes and `dashboardStats`).
 *
 * Has its own tiny Supabase call for branch-ownership lookup so it has no
 * dependency on `db.ts` — `db.ts` imports this module (one-way), never the
 * other way around, per `.claude/rules/01-architecture-boundaries.md`.
 */
import { getSupabase } from './supabase';
import { seesAllDealers } from './scope';
import { SessionUser } from './types';

export interface DealerScopeResult {
  /** null means "no dealer restriction" — only possible for a role that
   *  `seesAllDealers` and did not request a specific one. */
  dealerId: string | null;
  /** true if the caller is restricted to exactly one dealer (their own). */
  isPinned: boolean;
}

/** Resolves the dealer_id a query should filter by. A privileged role
 *  (`seesAllDealers`) gets whatever `requestedDealerId` it asked for (or
 *  `null` = "all dealers"); every other role is always pinned to their own
 *  session dealer, regardless of what the client requested — never trust
 *  a client-supplied dealerId for a non-privileged session. */
export function resolveDealerScope(session: SessionUser, requestedDealerId?: string | null): DealerScopeResult {
  if (seesAllDealers(session.role)) {
    return { dealerId: requestedDealerId ?? null, isPinned: false };
  }
  return { dealerId: session.dealerId, isPinned: true };
}

export interface BranchScopeResult {
  branchId: string | null;
  isPinned: boolean;
}

/** Resolves the branch_id a query should filter by. `DealerUser` is always
 *  pinned to their own session branch (a service branch is a team, not an
 *  individual — every DealerUser in a branch shares the same record
 *  visibility). Every other role may request any branch, but it must
 *  belong to the resolved dealer — validate separately via
 *  `assertBranchAccess` (single-record paths) or by always applying both
 *  the dealer and branch `.eq()` filters together (list paths, which then
 *  simply return zero rows for a mismatched pair rather than leaking). */
export function resolveBranchScope(session: SessionUser, dealerId: string | null, requestedBranchId?: string | null): BranchScopeResult {
  if (session.role === 'DealerUser') {
    return { branchId: session.branchId, isPinned: true };
  }
  return { branchId: requestedBranchId ?? null, isPinned: false };
}

/** Throws if `branchId` does not belong to `dealerId` — the read-path
 *  equivalent of the existing PM create-time check
 *  (`branch.dealer_id !== dealer.id`). Reserved for single-record
 *  detail/mutate paths where a 403 is the correct signal; list/filter
 *  reads don't need this (a mismatched dealer+branch pair already yields
 *  an empty result via the dealer+branch `.eq()` pair, which is
 *  sufficient and avoids turning a stale filter URL into an error page). */
export async function assertBranchAccess(dealerId: string | null, branchId: string | null): Promise<void> {
  if (!branchId) return;
  if (!dealerId) throw new Error('FORBIDDEN_BRANCH');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .eq('dealer_id', dealerId)
    .eq('id', branchId)
    .eq('active', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('FORBIDDEN_BRANCH');
}

/** Single-record authorization: may `session` access a record that
 *  belongs to `recordDealerId`/`recordBranchId`? Dealer must match (or the
 *  session sees all dealers); a `DealerUser` additionally must have their
 *  own session branch match the record's branch exactly — a `null`
 *  session branchId (not yet assigned by an admin) never matches
 *  anything, fail-closed rather than fail-open. */
export function canAccessDealerBranch(session: SessionUser, recordDealerId: string, recordBranchId: string | null): boolean {
  if (!seesAllDealers(session.role) && session.dealerId !== recordDealerId) return false;
  if (session.role === 'DealerUser') {
    return session.branchId != null && session.branchId === recordBranchId;
  }
  return true;
}

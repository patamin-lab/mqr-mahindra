'use client';

/**
 * DealerBranchScope — Platform Standard shared UI.
 *
 * Controlled, presentation-only (mirrors `SelectField`'s convention: all
 * logic lives in `useDealerBranchScope`, not here). Renders purely from
 * the hook's returned state, so no `role` prop is needed - pinning is
 * already encoded into `availableDealers`/no-op `changeDealer`/`changeBranch`:
 *
 * 1. `availableDealers.length > 0` -> two `<select>`s (SuperAdmin/CentralAdmin).
 * 2. Dealer pinned, branch not -> dealer as static text + one branch
 *    `<select>` (DealerAdmin).
 * 3. Both pinned -> two static text spans, no controls (DealerUser).
 */
import { UseDealerBranchScopeResult } from './useDealerBranchScope';

export interface DealerBranchSelectorProps {
  scope: UseDealerBranchScopeResult;
  /** Display name for a pinned dealer (DealerAdmin/DealerUser) - the hook
   *  never populates `availableDealers` for a pinned role, so there's
   *  nothing to look the name up in; the caller already has it from
   *  session/server data. */
  pinnedDealerName?: string | null;
  /** Display name for a pinned branch (DealerUser). */
  pinnedBranchName?: string | null;
  dealerLabel?: string;
  branchLabel?: string;
  dealerAllLabel?: string;
  branchAllLabel?: string;
  className?: string;
  /** Field names for the underlying `<select>`s - lets a native-`<form>`
   *  GET-reload page (e.g. Dashboard) submit these directly. */
  dealerFieldName?: string;
  branchFieldName?: string;
}

export default function DealerBranchSelector({
  scope,
  pinnedDealerName,
  pinnedBranchName,
  dealerLabel = 'ดีลเลอร์',
  branchLabel = 'สาขา',
  dealerAllLabel = 'ทั้งหมด',
  branchAllLabel = 'ทั้งหมด',
  className,
  dealerFieldName = 'dealerId',
  branchFieldName = 'branchId',
}: DealerBranchSelectorProps) {
  const { isDealerPinned, isBranchPinned } = scope;

  return (
    <div className={className}>
      <div>
        <label className="block text-xs font-medium mb-1">{dealerLabel}</label>
        {isDealerPinned ? (
          <p className="text-sm text-gray-800 py-2">{pinnedDealerName ?? '-'}</p>
        ) : (
          <select
            name={dealerFieldName}
            value={scope.currentDealer?.id ?? ''}
            onChange={(e) => void scope.changeDealer(e.target.value || null)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">{dealerAllLabel}</option>
            {scope.availableDealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.short_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">{branchLabel}</label>
        {isBranchPinned ? (
          <p className="text-sm text-gray-800 py-2">{pinnedBranchName ?? '-'}</p>
        ) : (
          <select
            name={branchFieldName}
            value={scope.currentBranch?.id ?? ''}
            onChange={(e) => scope.changeBranch(e.target.value || null)}
            disabled={scope.loadingBranches}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">{branchAllLabel}</option>
            {scope.availableBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

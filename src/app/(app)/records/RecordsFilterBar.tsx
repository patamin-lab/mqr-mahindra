'use client';

/**
 * MQR Records list's dealer/branch filter fields - Dealer/Branch Scope
 * Platform Standard. Embedded directly inside the Server Component page's
 * existing `<SearchToolbar>` `<form>` (search/status/date stay plain
 * native selects there, unchanged) - only the dealer/branch pair moves
 * into the shared hook/component, same pattern as Dashboard's/NTR's
 * migration.
 */
import { useDealerBranchScope } from '@/components/shared/scope/useDealerBranchScope';
import DealerBranchSelector from '@/components/shared/scope/DealerBranchSelector';
import type { Dealer, Role } from '@/lib/types';

export interface RecordsFilterBarProps {
  role: Role;
  sessionDealerId: string | null;
  sessionBranchId: string | null;
  pinnedDealerName?: string | null;
  pinnedBranchName?: string | null;
  initialDealers: Dealer[];
  initialDealerId?: string | null;
  initialBranchId?: string | null;
  dealerLabel: string;
  branchLabel: string;
  dealerAllLabel: string;
  branchAllLabel: string;
}

export default function RecordsFilterBar({
  role,
  sessionDealerId,
  sessionBranchId,
  pinnedDealerName,
  pinnedBranchName,
  initialDealers,
  initialDealerId,
  initialBranchId,
  dealerLabel,
  branchLabel,
  dealerAllLabel,
  branchAllLabel,
}: RecordsFilterBarProps) {
  const scope = useDealerBranchScope({
    role,
    sessionDealerId,
    sessionBranchId,
    initialDealers,
    initialDealerId,
    initialBranchId,
  });

  return (
    <DealerBranchSelector
      scope={scope}
      pinnedDealerName={pinnedDealerName}
      pinnedBranchName={pinnedBranchName}
      dealerLabel={dealerLabel}
      branchLabel={branchLabel}
      dealerAllLabel={dealerAllLabel}
      branchAllLabel={branchAllLabel}
      className="contents"
    />
  );
}

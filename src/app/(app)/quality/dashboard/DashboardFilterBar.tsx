'use client';

/**
 * Dashboard's filter bar — first vertical slice of the Dealer/Branch Scope
 * Platform Standard rollout. Year/month/model stay plain native selects,
 * submitted via the existing zero-JS-friendly `<form>` GET-reload
 * (`SearchToolbar`, unchanged). Only dealer/branch state management moves
 * into the shared `useDealerBranchScope` hook + `<DealerBranchSelector>`:
 * their `<select>`s carry the same `name="dealerId"`/`name="branchId"` so
 * the form submission is unaffected, but branch options now load only
 * after a dealer is known (never all branches up front) and are cached
 * per dealer. Dealer change never auto-submits - the whole form still
 * submits together via the existing "Filter" button, so a branch list
 * mid-refetch is never submitted stale.
 */
import SearchToolbar from '@/components/shared/layout/SearchToolbar';
import { useDealerBranchScope } from '@/components/shared/scope/useDealerBranchScope';
import DealerBranchSelector from '@/components/shared/scope/DealerBranchSelector';
import type { Dealer, Role } from '@/lib/types';

export interface DashboardFilterBarProps {
  role: Role;
  sessionDealerId: string | null;
  sessionBranchId: string | null;
  pinnedDealerName?: string | null;
  pinnedBranchName?: string | null;
  initialDealers: Dealer[];
  initialDealerId?: string | null;
  initialBranchId?: string | null;
  hasFilters: boolean;
  yearValue?: string;
  yearOptions: { value: string | number; label: string }[];
  monthValue?: string;
  monthOptions: string[];
  modelValue?: string;
  modelOptions: string[];
}

export default function DashboardFilterBar({
  role,
  sessionDealerId,
  sessionBranchId,
  pinnedDealerName,
  pinnedBranchName,
  initialDealers,
  initialDealerId,
  initialBranchId,
  hasFilters,
  yearValue,
  yearOptions,
  monthValue,
  monthOptions,
  modelValue,
  modelOptions,
}: DashboardFilterBarProps) {
  const scope = useDealerBranchScope({
    role,
    sessionDealerId,
    sessionBranchId,
    initialDealers,
    initialDealerId,
    initialBranchId,
  });

  return (
    <SearchToolbar
      cardVariant="flat"
      cardClassName="p-4 flex flex-wrap gap-3 items-end"
      filterLabel="กรอง"
      filterButtonClassName="px-4 py-2 rounded border border-gray-300 text-sm bg-gray-50"
      clearHref={hasFilters ? '/dashboard' : undefined}
      clearLabel="ล้างตัวกรอง"
    >
      <div>
        <label className="block text-xs font-medium mb-1">ปี (พ.ศ.)</label>
        <select name="year" defaultValue={yearValue ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
          <option value="">ทั้งหมด (12 เดือนล่าสุด)</option>
          {yearOptions.map((y) => (
            <option key={y.value} value={y.value}>
              {y.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">เดือน</label>
        <select name="month" defaultValue={monthValue ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
          <option value="">ทุกเดือน</option>
          {monthOptions.map((label, idx) => (
            <option key={label} value={idx + 1}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">รุ่นรถ</label>
        <select name="model" defaultValue={modelValue ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
          <option value="">ทุกรุ่น</option>
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <DealerBranchSelector
        scope={scope}
        pinnedDealerName={pinnedDealerName}
        pinnedBranchName={pinnedBranchName}
        dealerLabel="ดีลเลอร์"
        branchLabel="สาขา"
        className="contents"
      />
    </SearchToolbar>
  );
}

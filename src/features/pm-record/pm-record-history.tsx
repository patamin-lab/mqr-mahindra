'use client';

/**
 * PM History Center (Phase 4a) - the primary screen for Customer Care,
 * Dealer, Service Manager, and Head Office to search/filter PM Records.
 * Server-side pagination/filtering/search throughout - never loads the
 * full table into the browser, per the "100,000+ records" requirement.
 *
 * CSV/PDF/Bulk export (Phase 4b/4c) are not wired up yet - the row
 * selection mechanism here is built so those sub-phases can attach to it
 * directly, per spec's "Multi Select" being separate from the export
 * features themselves.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { fetchJson } from '@/lib/fetchJson';
import { swalErrorToast } from '@/lib/swal';
import TextField from '@/components/shared/forms/TextField';
import SelectField from '@/components/shared/forms/SelectField';
import type { Dealer, PmInterval, Technician, Branch } from '@/lib/types';
import type { PmRecord, PmHistorySortField, PmHistorySortDir } from './types';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

type QuickFilterKey =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'overdue'
  | 'upcoming';

const QUICK_FILTER_LABELS: Record<QuickFilterKey, string> = {
  today: 'วันนี้',
  yesterday: 'เมื่อวาน',
  thisWeek: 'สัปดาห์นี้',
  thisMonth: 'เดือนนี้',
  lastMonth: 'เดือนก่อน',
  thisYear: 'ปีนี้',
  overdue: 'เลยกำหนด PM',
  upcoming: 'ใกล้ถึงกำหนด PM',
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function quickFilterDateRange(key: QuickFilterKey): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  switch (key) {
    case 'today':
      return { dateFrom: isoDate(now), dateTo: isoDate(now) };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { dateFrom: isoDate(y), dateTo: isoDate(y) };
    }
    case 'thisWeek': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { dateFrom: isoDate(start), dateTo: isoDate(now) };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: isoDate(start), dateTo: isoDate(now) };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { dateFrom: isoDate(start), dateTo: isoDate(end) };
    }
    case 'thisYear': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { dateFrom: isoDate(start), dateTo: isoDate(now) };
    }
    default:
      return {};
  }
}

interface AdvancedFilters {
  dealerId: string;
  branchId: string;
  technicianId: string;
  pmIntervalId: string;
  pmNumber: string;
  serial: string;
  customerName: string;
  customerPhone: string;
  model: string;
  hourMeterMin: string;
  hourMeterMax: string;
  createdBy: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: AdvancedFilters = {
  dealerId: '',
  branchId: '',
  technicianId: '',
  pmIntervalId: '',
  pmNumber: '',
  serial: '',
  customerName: '',
  customerPhone: '',
  model: '',
  hourMeterMin: '',
  hourMeterMax: '',
  createdBy: '',
  status: '',
  dateFrom: '',
  dateTo: '',
};

/** Saved Filters (Phase 4a spec: "Remember Dealer, Branch, Date, Sort per
 *  logged-in user, restore automatically") - localStorage only, keyed per
 *  username, matching the same lightweight pattern as Phase 2's Recent
 *  Vehicles (no new table needed for ephemeral per-user UI preference). */
function savedFiltersKey(username: string) {
  return `pm_record_history_saved_filters_${username}`;
}

interface SavedFilters {
  dealerId: string;
  branchId: string;
  dateFrom: string;
  dateTo: string;
  sortField: PmHistorySortField;
  sortDir: PmHistorySortDir;
}

const columnHelper = createColumnHelper<PmRecord>();

interface Props {
  dealers: Dealer[];
  showDealerField: boolean;
  defaultDealerId: string | null;
  username: string;
}

export default function PmRecordHistory({ dealers, showDealerField, defaultDealerId, username }: Props) {
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey | null>(null);
  const [search, setSearch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>({
    ...EMPTY_FILTERS,
    dealerId: defaultDealerId ?? '',
  });

  const [branches, setBranches] = useState<Branch[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [pmIntervals, setPmIntervals] = useState<PmInterval[]>([]);

  const [data, setData] = useState<PmRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'performed_date', desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Restore saved filters (dealer/branch/date/sort) once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(savedFiltersKey(username));
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedFilters;
      setFilters((prev) => ({
        ...prev,
        dealerId: saved.dealerId || prev.dealerId,
        branchId: saved.branchId || prev.branchId,
        dateFrom: saved.dateFrom || '',
        dateTo: saved.dateTo || '',
      }));
      if (saved.sortField) setSorting([{ id: saved.sortField, desc: saved.sortDir !== 'asc' }]);
    } catch {
      // ignore malformed saved filters
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const json = await fetchJson<{ ok: boolean; pmIntervals: PmInterval[] }>('/api/pm-intervals');
        setPmIntervals(json.pmIntervals ?? []);
      } catch {
        // non-fatal - interval column falls back to showing the raw id
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!filters.dealerId) {
        setBranches([]);
        return;
      }
      try {
        const [branchJson, technicianJson] = await Promise.all([
          fetchJson<{ ok: boolean; branches: Branch[] }>(`/api/branches?dealerId=${encodeURIComponent(filters.dealerId)}`),
          fetchJson<{ ok: boolean; technicians: Technician[] }>(
            `/api/technicians?dealerId=${encodeURIComponent(filters.dealerId)}`
          ),
        ]);
        if (!cancelled) {
          setBranches(branchJson.branches ?? []);
          setTechnicians(technicianJson.technicians ?? []);
        }
      } catch {
        if (!cancelled) {
          setBranches([]);
          setTechnicians([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.dealerId]);

  const pmIntervalLabel = useMemo(() => {
    const map = new Map(pmIntervals.map((iv) => [iv.id, iv.label]));
    return (id: string | null) => (id ? map.get(id) ?? id : '-');
  }, [pmIntervals]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sort = sorting[0];
      const params = new URLSearchParams();
      if (filters.dealerId) params.set('dealerId', filters.dealerId);
      if (filters.branchId) params.set('branchId', filters.branchId);
      if (filters.technicianId) params.set('technicianId', filters.technicianId);
      if (filters.pmIntervalId) params.set('pmIntervalId', filters.pmIntervalId);
      if (filters.pmNumber) params.set('pmNumber', filters.pmNumber);
      if (filters.serial) params.set('serial', filters.serial);
      if (filters.customerName) params.set('customerName', filters.customerName);
      if (filters.customerPhone) params.set('customerPhone', filters.customerPhone);
      if (filters.model) params.set('model', filters.model);
      if (filters.hourMeterMin) params.set('hourMeterMin', filters.hourMeterMin);
      if (filters.hourMeterMax) params.set('hourMeterMax', filters.hourMeterMax);
      if (filters.createdBy) params.set('createdBy', filters.createdBy);
      if (filters.status) params.set('status', filters.status);
      if (search.trim()) params.set('search', search.trim());

      if (quickFilter === 'overdue') {
        params.set('overdue', 'true');
      } else if (quickFilter === 'upcoming') {
        params.set('upcoming', 'true');
      } else if (quickFilter) {
        const range = quickFilterDateRange(quickFilter);
        if (range.dateFrom) params.set('dateFrom', range.dateFrom);
        if (range.dateTo) params.set('dateTo', range.dateTo);
      } else {
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
        if (filters.dateTo) params.set('dateTo', filters.dateTo);
      }

      params.set('page', String(pageIndex + 1));
      params.set('pageSize', String(pageSize));
      if (sort) {
        params.set('sortField', sort.id);
        params.set('sortDir', sort.desc ? 'desc' : 'asc');
      }

      const json = await fetchJson<{ ok: boolean; data: PmRecord[]; total: number }>(
        `/api/pm-records/history?${params.toString()}`
      );
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch (err) {
      await swalErrorToast(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, search, quickFilter, pageIndex, pageSize, sorting]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Any filter change resets to page 1 and clears the current page's selection.
  useEffect(() => {
    setPageIndex(0);
    setRowSelection({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, search, quickFilter]);

  function saveCurrentFilters() {
    if (typeof window === 'undefined') return;
    const sort = sorting[0];
    const toSave: SavedFilters = {
      dealerId: filters.dealerId,
      branchId: filters.branchId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      sortField: (sort?.id as PmHistorySortField) ?? 'performed_date',
      sortDir: sort?.desc === false ? 'asc' : 'desc',
    };
    window.localStorage.setItem(savedFiltersKey(username), JSON.stringify(toSave));
  }

  function clearFilters() {
    setFilters({ ...EMPTY_FILTERS, dealerId: defaultDealerId ?? '' });
    setSearch('');
    setQuickFilter(null);
  }

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        size: 36,
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input type="checkbox" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
        ),
      }),
      columnHelper.accessor('pm_number', { header: 'เลขที่ PM', size: 160 }),
      columnHelper.accessor('performed_date', { header: 'วันที่', size: 110 }),
      columnHelper.accessor('dealer_id', { header: 'ดีลเลอร์', size: 90 }),
      columnHelper.accessor('branch_name', { header: 'สาขา', size: 110, cell: (c) => c.getValue() ?? '-' }),
      columnHelper.accessor('serial', { header: 'Serial', size: 130, cell: (c) => c.getValue() ?? '-' }),
      columnHelper.accessor('customer_name', { header: 'ลูกค้า', size: 140, cell: (c) => c.getValue() ?? '-' }),
      columnHelper.accessor('customer_phone', { header: 'เบอร์โทร', size: 110, cell: (c) => c.getValue() ?? '-' }),
      columnHelper.accessor('model', { header: 'รุ่น', size: 110, cell: (c) => c.getValue() ?? '-' }),
      columnHelper.accessor('hour_meter', { header: 'ชั่วโมง', size: 90, cell: (c) => c.getValue() ?? '-' }),
      columnHelper.accessor('pm_interval_id', {
        header: 'รอบ PM',
        size: 130,
        cell: (c) => pmIntervalLabel(c.getValue()),
      }),
      columnHelper.accessor('technician_name', { header: 'ช่างซ่อม', size: 120, cell: (c) => c.getValue() ?? '-' }),
      columnHelper.accessor('status', { header: 'สถานะ', size: 90 }),
      columnHelper.display({
        id: 'actions',
        header: 'จัดการ',
        size: 90,
        cell: ({ row }) => (
          <Link href={`/pm-records/${encodeURIComponent(row.original.id)}`} className="text-brand-red hover:underline">
            ดูรายละเอียด
          </Link>
        ),
      }),
    ],
    [pmIntervalLabel]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    columnResizeMode: 'onChange',
  });

  const dealerOptions = [{ value: '', label: '-- ทุกดีลเลอร์ --' }, ...dealers.map((d) => ({ value: d.id, label: d.short_name }))];
  const branchOptions = [{ value: '', label: '-- ทุกสาขา --' }, ...branches.map((b) => ({ value: b.id, label: b.name }))];
  const technicianOptions = [{ value: '', label: '-- ทุกช่าง --' }, ...technicians.map((t) => ({ value: t.id, label: t.name }))];
  const pmIntervalOptions = [{ value: '', label: '-- ทุกรอบ PM --' }, ...pmIntervals.map((iv) => ({ value: iv.id, label: iv.label }))];

  const selectedCount = Object.keys(rowSelection).length;
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">ประวัติ PM (PM History Center)</h1>
          <p className="text-sm text-gray-500">ค้นหา กรอง และส่งออกข้อมูล PM Record ทั้งหมดที่นี่</p>
        </div>
        <Link href="/pm-records/new" className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark">
          + บันทึก PM ใหม่
        </Link>
      </div>

      {/* Universal search */}
      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <TextField
          label="ค้นหา (เลขที่ PM / Serial / ลูกค้า / เบอร์โทร / ช่าง / หมายเหตุ / ดีลเลอร์ / สาขา / รุ่น)"
          value={search}
          onChange={setSearch}
          placeholder="พิมพ์คำค้นหา..."
        />
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(QUICK_FILTER_LABELS) as QuickFilterKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setQuickFilter(quickFilter === key ? null : key)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              quickFilter === key ? 'border-brand-red bg-brand-red text-white' : 'border-gray-300 bg-white hover:bg-gray-50'
            }`}
          >
            {QUICK_FILTER_LABELS[key]}
          </button>
        ))}
        <button
          type="button"
          onClick={clearFilters}
          className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
        >
          ล้างตัวกรอง
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="ml-auto rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
        >
          {showAdvanced ? 'ซ่อนตัวกรองขั้นสูง' : 'ตัวกรองขั้นสูง'}
        </button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
            {showDealerField && (
              <SelectField
                label="ดีลเลอร์"
                value={filters.dealerId}
                onChange={(v) => setFilters((f) => ({ ...f, dealerId: v, branchId: '' }))}
                options={dealerOptions}
              />
            )}
            <SelectField
              label="สาขา"
              value={filters.branchId}
              onChange={(v) => setFilters((f) => ({ ...f, branchId: v }))}
              options={branchOptions}
            />
            <SelectField
              label="ช่างซ่อม"
              value={filters.technicianId}
              onChange={(v) => setFilters((f) => ({ ...f, technicianId: v }))}
              options={technicianOptions}
            />
            <SelectField
              label="รอบ PM"
              value={filters.pmIntervalId}
              onChange={(v) => setFilters((f) => ({ ...f, pmIntervalId: v }))}
              options={pmIntervalOptions}
            />
            <TextField label="เลขที่ PM" value={filters.pmNumber} onChange={(v) => setFilters((f) => ({ ...f, pmNumber: v }))} />
            <TextField label="Serial" value={filters.serial} onChange={(v) => setFilters((f) => ({ ...f, serial: v }))} />
            <TextField
              label="ชื่อลูกค้า"
              value={filters.customerName}
              onChange={(v) => setFilters((f) => ({ ...f, customerName: v }))}
            />
            <TextField
              label="เบอร์โทรศัพท์"
              value={filters.customerPhone}
              onChange={(v) => setFilters((f) => ({ ...f, customerPhone: v }))}
            />
            <TextField label="รุ่น" value={filters.model} onChange={(v) => setFilters((f) => ({ ...f, model: v }))} />
            <TextField
              label="ชั่วโมง (ต่ำสุด)"
              value={filters.hourMeterMin}
              onChange={(v) => setFilters((f) => ({ ...f, hourMeterMin: v }))}
            />
            <TextField
              label="ชั่วโมง (สูงสุด)"
              value={filters.hourMeterMax}
              onChange={(v) => setFilters((f) => ({ ...f, hourMeterMax: v }))}
            />
            <TextField
              label="บันทึกโดย"
              value={filters.createdBy}
              onChange={(v) => setFilters((f) => ({ ...f, createdBy: v }))}
            />
            <TextField label="สถานะ" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} />
            <div>
              <label className="block text-xs text-gray-500 mb-1">วันที่เริ่ม</label>
              <input
                type="date"
                className="border rounded px-2 py-1.5 text-sm w-full"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                disabled={!!quickFilter}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">วันที่สิ้นสุด</label>
              <input
                type="date"
                className="border rounded px-2 py-1.5 text-sm w-full"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                disabled={!!quickFilter}
              />
            </div>
          </div>
          <button type="button" onClick={saveCurrentFilters} className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50">
            บันทึกตัวกรองนี้ไว้ใช้ครั้งถัดไป
          </button>
        </div>
      )}

      {/* Column visibility */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span>แสดงคอลัมน์:</span>
        {table.getAllLeafColumns().map((col) => {
          if (col.id === 'select' || col.id === 'actions') return null;
          return (
            <label key={col.id} className="flex items-center gap-1">
              <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} />
              {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
            </label>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded border border-brand-red/30 bg-red-50 px-4 py-2 text-sm">
          <span>เลือกแล้ว {selectedCount} รายการ</span>
          <div className="flex gap-2">
            <button type="button" disabled title="เร็วๆ นี้ (Phase 4b)" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs opacity-50">
              ส่งออก CSV
            </button>
            <button type="button" disabled title="เร็วๆ นี้ (Phase 4b)" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs opacity-50">
              ส่งออก PDF
            </button>
            <button type="button" disabled title="เร็วๆ นี้ (Phase 4c)" className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs opacity-50">
              ดาวน์โหลดรูปภาพ
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
        <table className="text-sm" style={{ width: table.getTotalSize() }}>
          <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase text-gray-500">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="relative select-none px-3 py-2"
                    style={{ width: header.getSize() }}
                  >
                    <div
                      className={header.column.getCanSort() && header.id !== 'select' && header.id !== 'actions' ? 'cursor-pointer' : ''}
                      onClick={
                        header.id !== 'select' && header.id !== 'actions'
                          ? () => setSorting((prev) => {
                              const existing = prev[0];
                              if (existing?.id === header.id) return [{ id: header.id, desc: !existing.desc }];
                              return [{ id: header.id, desc: true }];
                            })
                          : undefined
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorting[0]?.id === header.id && (sorting[0].desc ? ' ▼' : ' ▲')}
                    </div>
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-brand-red/40"
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-gray-400">
                  กำลังโหลด...
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-gray-400">
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
            {!loading &&
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2" style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">แสดง</span>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageIndex(0);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-gray-500">ต่อหน้า · ทั้งหมด {total} รายการ</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pageIndex === 0}
            onClick={() => setPageIndex((p) => Math.max(p - 1, 0))}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            ก่อนหน้า
          </button>
          <span className="text-gray-500">
            หน้า {pageIndex + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={pageIndex + 1 >= pageCount}
            onClick={() => setPageIndex((p) => p + 1)}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      </div>
    </div>
  );
}

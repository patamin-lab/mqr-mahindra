'use client';

import { useEffect, useState } from 'react';

export interface VehicleSnapshot {
  serial: string;
  model: string | null;
  delivery_date: string | null;
  source?: 'supabase' | 'tractor_in_sheet';
}

interface VehicleListItem {
  serial: string;
  model: string | null;
  deliveryDate: string | null;
  source: 'supabase' | 'tractor_in_sheet';
}

interface Props {
  /** Controlled value — the serial number text in the input. */
  value: string;
  onChange: (serial: string) => void;
  /** Called with the matched vehicle when confirmed, or null when cleared. */
  onSelect: (vehicle: VehicleSnapshot | null) => void;
  disabled?: boolean;
}

const CACHE_KEY = 'mqr_vehicle_list_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/**
 * Shared vehicle serial autocomplete.
 *
 * Phase 1 — preload: fetches the full vehicle list from /api/vehicles/list on
 * mount (sessionStorage cache makes repeat visits free within a shift).
 * Filters client-side as the user types.
 *
 * Phase 2 — fallback: if the user blurs on a serial not in the preloaded
 * list, an exact lookup via /api/vehicles/{serial} runs automatically
 * (covers units not yet synced to the preloaded list).
 *
 * Used by: PM Record form (Sprint 11.1).
 */
export default function VehicleAutocomplete({ value, onChange, onSelect, disabled }: Props) {
  const [allVehicles, setAllVehicles] = useState<VehicleListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<VehicleListItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState<VehicleSnapshot | null>(null);

  // Preload the full vehicle list once per session (shared cache with report form).
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, results } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL_MS && Array.isArray(results)) {
          setAllVehicles(results);
          setListLoading(false);
          return;
        }
      }
    } catch { /* corrupt / unavailable — fall through to fetch */ }

    (async () => {
      try {
        const res = await fetch('/api/vehicles/list');
        const json = await res.json();
        if (json.ok) {
          setAllVehicles(json.results);
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), results: json.results }));
          } catch { /* sessionStorage full / unavailable */ }
        }
      } catch { /* falls back to manual entry + blur exact-lookup */ } finally {
        setListLoading(false);
      }
    })();
  }, []);

  // Filter dropdown as the user types.
  useEffect(() => {
    if (selected) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    const term = value.trim().toUpperCase();
    const matches = term
      ? allVehicles.filter((v) => v.serial.toUpperCase().includes(term)).slice(0, 30)
      : allVehicles.slice(0, 30);
    setSearchResults(matches);
  }, [value, selected, allVehicles]);

  function handleChange(raw: string) {
    onChange(raw);
    setSearchOpen(true);
    if (selected) {
      setSelected(null);
      setChecked(false);
      onSelect(null);
    }
  }

  function handleFocus() {
    if (!selected) setSearchOpen(true);
  }

  function selectItem(item: VehicleListItem) {
    setSearchOpen(false);
    const snapshot: VehicleSnapshot = {
      serial: item.serial,
      model: item.model,
      delivery_date: item.deliveryDate,
      source: item.source,
    };
    setSelected(snapshot);
    setChecked(true);
    onChange(item.serial);
    onSelect(snapshot);

    // Non-blocking enrichment: get the full Vehicle record after the instant
    // autofill above has already populated the form.
    fetch(`/api/vehicles/${encodeURIComponent(item.serial)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok && json.found) {
          const enriched: VehicleSnapshot = {
            serial: json.vehicle.serial,
            model: json.vehicle.model,
            delivery_date: json.vehicle.delivery_date,
            source: item.source,
          };
          setSelected(enriched);
          onSelect(enriched);
        }
      })
      .catch(() => { /* ignore — initial autofill is sufficient */ });
  }

  // Fallback exact-match for serials typed by hand (not in preloaded list).
  async function checkExact() {
    if (!value.trim() || selected) return;
    setChecking(true);
    setChecked(false);
    try {
      const res = await fetch(`/api/vehicles/${encodeURIComponent(value.trim())}`);
      const json = await res.json();
      if (json.ok && json.found) {
        const snapshot: VehicleSnapshot = {
          serial: json.vehicle.serial,
          model: json.vehicle.model,
          delivery_date: json.vehicle.delivery_date,
        };
        setSelected(snapshot);
        onChange(json.vehicle.serial);
        onSelect(snapshot);
      } else {
        setSelected(null);
        onSelect(null);
      }
    } finally {
      setChecking(false);
      setChecked(true);
      setSearchOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-50"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={() => setTimeout(() => { setSearchOpen(false); checkExact(); }, 150)}
        autoComplete="off"
        disabled={disabled}
        placeholder={listLoading ? 'กำลังโหลดรายการเลขรถ...' : 'เลือกจากรายการ หรือพิมพ์หมายเลขรถ...'}
        required
      />

      {searchOpen && searchResults.length > 0 && (
        <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-56 overflow-y-auto text-sm">
          {searchResults.map((r) => (
            <li key={r.serial}>
              <button
                type="button"
                onClick={() => selectItem(r)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center"
              >
                <span className="font-mono">{r.serial}</span>
                <span className="text-gray-500 text-xs">{r.model ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {checked && !checking && !searchOpen && (
        <p className={`text-xs mt-1 ${selected ? 'text-green-600' : 'text-amber-600'}`}>
          {selected
            ? `พบในระบบ: ${selected.model ?? ''}${
                selected.source === 'tractor_in_sheet'
                  ? ' (จากฐานข้อมูล Tractor IN — ยังไม่มีข้อมูลส่งมอบ)'
                  : ''
              }`
            : 'ไม่พบหมายเลขรถนี้ในระบบ — กรุณาตรวจสอบหมายเลขรถอีกครั้ง'}
        </p>
      )}
      {checking && <p className="text-xs mt-1 text-gray-400">กำลังตรวจสอบ...</p>}
    </div>
  );
}

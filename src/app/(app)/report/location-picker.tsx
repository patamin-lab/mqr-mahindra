'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Map as LeafletMap } from 'leaflet';

// Leaflet touches `window` at import time, so the map itself must be loaded
// client-side only (no SSR) - dynamic() with ssr:false handles that.
const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
      กำลังโหลดแผนที่...
    </div>
  ),
});

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const mapRef = useRef<LeafletMap | null>(null);

  // Intentionally a plain function triggered by a type="button" click / Enter
  // keydown, NOT a nested <form onSubmit>. This component is rendered inside
  // the page's main report <form>, and nested <form> elements are invalid
  // HTML - the browser's parser drops the inner <form> tag from server-
  // rendered markup, which silently reassigns this button's form ownership
  // to the OUTER report form. The result: clicking "ค้นหา" here submitted/
  // reloaded the whole report page instead of running the place search.
  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      // accept-language=th asks Nominatim to return place names in Thai
      // (matching the language the user is typing the query in) instead of
      // always falling back to English/local-Latin transliteration.
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=th&accept-language=th&q=${encodeURIComponent(
        query.trim()
      )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('ค้นหาไม่สำเร็จ');
      const json = (await res.json()) as SearchResult[];
      setResults(json);
      if (json.length === 0) setSearchError('ไม่พบสถานที่ที่ค้นหา');
    } catch {
      setSearchError('ค้นหาไม่สำเร็จ กรุณาลองใหม่ หรือคลิกตำแหน่งบนแผนที่โดยตรง');
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r: SearchResult) {
    const la = parseFloat(r.lat);
    const ln = parseFloat(r.lon);
    onChange(la, ln);
    setResults([]);
    setQuery(r.display_name);
    mapRef.current?.flyTo([la, ln], 16);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setSearchError('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        onChange(la, ln);
        mapRef.current?.flyTo([la, ln], 16);
      },
      () => setSearchError('ไม่สามารถระบุตำแหน่งปัจจุบันได้'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 flex gap-2">
          <input
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="ค้นหาชื่อสถานที่ / อำเภอ / จังหวัด"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              // Clicking back into the field after a search/selection clears
              // the old text immediately so the user can type a fresh query
              // without having to manually select-all + delete first.
              if (query) {
                setQuery('');
                setResults([]);
                setSearchError('');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
              }
            }}
          />
          <button
            type="button"
            onClick={runSearch}
            className="btn-secondary whitespace-nowrap"
            disabled={searching}
          >
            {searching ? 'ค้นหา...' : 'ค้นหา'}
          </button>
        </div>
        <button type="button" onClick={useCurrentLocation} className="btn-secondary whitespace-nowrap">
          ใช้ตำแหน่งปัจจุบัน
        </button>
      </div>

      {results.length > 0 && (
        <ul className="border border-gray-200 rounded divide-y divide-gray-100 text-sm max-h-40 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i} className="px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => selectResult(r)}>
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
      {searchError && <p className="text-xs text-amber-600">{searchError}</p>}

      <MapView lat={lat} lng={lng} onPick={(la, ln) => onChange(la, ln)} mapRef={mapRef} />

      <p className="text-xs text-gray-500">
        {lat !== null && lng !== null
          ? `พิกัดที่เลือก: ${lat.toFixed(6)}, ${lng.toFixed(6)} (คลิกบนแผนที่เพื่อปรับตำแหน่ง)`
          : 'ค้นหาสถานที่ ใช้ตำแหน่งปัจจุบัน หรือคลิกบนแผนที่เพื่อปักหมุด'}
      </p>
    </div>
  );
}

'use client';

/**
 * GPS location picker (reusable) - search by place name (village/
 * subdistrict/district/province), "Use Current Location" with accuracy
 * display/low-signal warning, a draggable-marker satellite map, and a
 * display-only reverse-geocoded address. Not PM-Record-specific - any
 * future module needing GPS capture can reuse this component as-is.
 */
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Map as LeafletMap } from 'leaflet';
import { searchThaiPlace, reverseGeocode, ForwardGeocodeResult } from './reverseGeocode';
import {
  GpsLocation,
  ReverseGeocodeResult,
  googleMapsUrlFor,
  isValidLatLng,
  parseDirectCoordinates,
  LOW_ACCURACY_THRESHOLD_M,
} from './types';

const GpsMapView = dynamic(() => import('./GpsMapView'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
      กำลังโหลดแผนที่...
    </div>
  ),
});

export interface GpsLocationPickerProps {
  value: GpsLocation;
  onChange: (value: GpsLocation) => void;
}

export default function GpsLocationPicker({ value, onChange }: GpsLocationPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ForwardGeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [address, setAddress] = useState<ReverseGeocodeResult | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const { latitude, longitude, accuracy } = value;

  useEffect(() => {
    let cancelled = false;
    if (latitude === null || longitude === null) {
      setAddress(null);
      return;
    }
    reverseGeocode(latitude, longitude).then((result) => {
      if (!cancelled) setAddress(result);
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  function setLocation(lat: number, lng: number, acc: number | null) {
    if (!isValidLatLng(lat, lng)) {
      setError('พิกัดไม่ถูกต้อง');
      return;
    }
    onChange({ latitude: lat, longitude: lng, accuracy: acc, googleMapsUrl: googleMapsUrlFor(lat, lng) });
  }

  async function runSearch() {
    if (!query.trim()) return;
    setError('');

    // "Allow search by ... Latitude / Longitude / Google Maps URL" - a
    // pasted coordinate pair or Google Maps link jumps straight to that
    // point, no geocoding round-trip needed.
    const direct = parseDirectCoordinates(query);
    if (direct) {
      setLocation(direct.lat, direct.lng, null);
      setResults([]);
      mapRef.current?.flyTo([direct.lat, direct.lng], 16);
      return;
    }

    setSearching(true);
    try {
      const found = await searchThaiPlace(query);
      setResults(found);
      if (found.length === 0) setError('ไม่พบสถานที่ที่ค้นหา');
    } catch {
      setError('ค้นหาไม่สำเร็จ กรุณาลองใหม่ หรือคลิก/ลากหมุดบนแผนที่โดยตรง');
    } finally {
      setSearching(false);
    }
  }

  function selectResult(r: ForwardGeocodeResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setLocation(lat, lng, null);
    setResults([]);
    setQuery(r.display_name);
    mapRef.current?.flyTo([lat, lng], 16);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 16);
      },
      () => setError('ไม่สามารถระบุตำแหน่งปัจจุบันได้'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const lowAccuracy = accuracy !== null && accuracy > LOW_ACCURACY_THRESHOLD_M;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-1 min-w-[200px] gap-2">
          <input
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="ค้นหา หมู่บ้าน/ตำบล/อำเภอ/จังหวัด หรือวางพิกัด/ลิงก์ Google Maps"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
            disabled={searching}
            className="rounded border border-gray-300 px-3 py-2 text-sm whitespace-nowrap hover:bg-gray-50 disabled:opacity-50"
          >
            {searching ? 'ค้นหา...' : 'ค้นหา'}
          </button>
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="rounded border border-gray-300 px-3 py-2 text-sm whitespace-nowrap hover:bg-gray-50"
        >
          📍 ใช้ตำแหน่งปัจจุบัน
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
      {error && <p className="text-xs text-amber-600">{error}</p>}

      <GpsMapView
        lat={latitude}
        lng={longitude}
        onPick={(lat, lng) => setLocation(lat, lng, null)}
        mapRef={mapRef}
      />

      {latitude !== null && longitude !== null && (
        <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          <p>
            พิกัด: {latitude.toFixed(6)}, {longitude.toFixed(6)}
            {accuracy !== null && ` (ความแม่นยำ ±${Math.round(accuracy)} m)`}
          </p>
          {lowAccuracy && (
            <p className="text-amber-600">ความแม่นยำของสัญญาณ GPS ต่ำ กรุณารอสัญญาณ GPS ที่แรงขึ้น</p>
          )}
          {address && (
            <p>
              {address.village ?? '-'} / {address.subdistrict ?? '-'} / {address.district ?? '-'} /{' '}
              {address.province ?? '-'}
            </p>
          )}
        </div>
      )}
      {latitude === null && (
        <p className="text-xs text-gray-500">ค้นหาสถานที่ ใช้ตำแหน่งปัจจุบัน หรือคลิก/ลากหมุดบนแผนที่ (ไม่บังคับ)</p>
      )}
    </div>
  );
}

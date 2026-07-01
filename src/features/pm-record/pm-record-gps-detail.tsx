'use client';

import dynamic from 'next/dynamic';

const GpsMapView = dynamic(() => import('@/components/shared/gps/GpsMapView'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400">
      กำลังโหลดแผนที่...
    </div>
  ),
});

export default function PmRecordGpsDetail({
  latitude,
  longitude,
  accuracy,
  googleMapsUrl,
}: {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  googleMapsUrl: string | null;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-brand-dark">พิกัดตำแหน่ง</h2>
      <GpsMapView lat={latitude} lng={longitude} readOnly />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
        <p>
          พิกัด: {latitude.toFixed(6)}, {longitude.toFixed(6)}
          {accuracy !== null && ` (ความแม่นยำ ±${Math.round(accuracy)} m)`}
        </p>
        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded bg-brand-red px-3 py-1.5 text-xs text-white hover:bg-brand-dark"
          >
            เปิดใน Google Maps
          </a>
        )}
      </div>
    </div>
  );
}

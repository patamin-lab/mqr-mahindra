'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L, { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet's default marker images are relative paths that break under
// Next.js/webpack bundling - point them at the CDN copies instead.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const THAILAND_CENTER: [number, number] = [13.7563, 100.5018];

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyOnChange({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 14));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

export default function MapView({
  lat,
  lng,
  onPick,
  mapRef,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  mapRef: React.MutableRefObject<LeafletMap | null>;
}) {
  const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : THAILAND_CENTER;
  const zoom = lat !== null && lng !== null ? 15 : 6;

  return (
    <div className="h-64 w-full rounded border border-gray-200 overflow-hidden">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />
        <ClickHandler onPick={onPick} />
        <FlyOnChange lat={lat} lng={lng} />
        {lat !== null && lng !== null && <Marker position={[lat, lng]} />}
      </MapContainer>
    </div>
  );
}

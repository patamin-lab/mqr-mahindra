'use client';

/**
 * Map Component (reusable) - Leaflet + Esri World Imagery (satellite,
 * never a road map, per spec), the same free tile source already used by
 * the QIR report form's map-view.tsx. Adds a draggable marker on top of
 * that existing pattern. Must be loaded client-side only (see
 * GpsLocationPicker.tsx's dynamic() wrapper) since Leaflet touches
 * `window` at import time.
 */
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L, { Map as LeafletMap, LeafletEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

export interface GpsMapViewProps {
  lat: number | null;
  lng: number | null;
  /** Omit (or set readOnly) to render a static, non-interactive map, e.g.
   *  for a detail/view page. */
  onPick?: (lat: number, lng: number) => void;
  readOnly?: boolean;
  mapRef?: React.MutableRefObject<LeafletMap | null>;
  heightClassName?: string;
}

export default function GpsMapView({ lat, lng, onPick, readOnly, mapRef, heightClassName = 'h-64' }: GpsMapViewProps) {
  const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : THAILAND_CENTER;
  const zoom = lat !== null && lng !== null ? 15 : 6;

  return (
    <div className={`${heightClassName} w-full rounded border border-gray-200 overflow-hidden`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={!readOnly}
        dragging={!readOnly}
        doubleClickZoom={!readOnly}
        touchZoom={!readOnly}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />
        {!readOnly && onPick && <ClickHandler onPick={onPick} />}
        <FlyOnChange lat={lat} lng={lng} />
        {lat !== null && lng !== null && (
          <Marker
            position={[lat, lng]}
            draggable={!readOnly}
            eventHandlers={
              !readOnly && onPick
                ? {
                    dragend: (e: LeafletEvent) => {
                      const marker = e.target as L.Marker;
                      const pos = marker.getLatLng();
                      onPick(pos.lat, pos.lng);
                    },
                  }
                : undefined
            }
          />
        )}
      </MapContainer>
    </div>
  );
}

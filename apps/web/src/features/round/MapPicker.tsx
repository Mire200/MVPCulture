'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useId, useRef } from 'react';

// Icônes Leaflet : setup unique (idempotent pour survivre au HMR).
const ICON_FLAG = '__mvpcLeafletIcon';
if (typeof window !== 'undefined' && !(window as unknown as Record<string, unknown>)[ICON_FLAG]) {
  const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
  L.Marker.prototype.options.icon = DefaultIcon;
  (window as unknown as Record<string, unknown>)[ICON_FLAG] = true;
}

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (c: { lat: number; lng: number }) => void;
  readOnly?: boolean;
  height?: number;
  /** Clé logique (ex: id de la question) : change => remount complet. */
  resetKey?: string | number;
}

function ClickHandler({
  onChange,
  readOnly,
}: {
  onChange: Props['onChange'];
  readOnly?: boolean;
}) {
  useMapEvents({
    click(e) {
      if (!readOnly) onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function MapPicker({ value, onChange, readOnly, height = 320, resetKey }: Props) {
  const fallbackId = useId();
  const mapKey = `${resetKey ?? fallbackId}`;
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Cleanup défensif : en cas de Fast Refresh, supprime un éventuel _leaflet_id
  // laissé sur le DOM pour permettre à la prochaine instance de s'initialiser.
  useEffect(() => {
    const node = rootRef.current;
    return () => {
      if (node) {
        node.querySelectorAll('.leaflet-container').forEach((el) => {
          delete (el as unknown as { _leaflet_id?: number })._leaflet_id;
        });
      }
    };
  }, []);

  return (
    <div ref={rootRef} style={{ height }} className="w-full">
      <MapContainer
        key={mapKey}
        center={[30, 10]}
        zoom={2}
        worldCopyJump
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <ClickHandler onChange={onChange} readOnly={readOnly} />
        {value && <Marker position={[value.lat, value.lng]} />}
      </MapContainer>
    </div>
  );
}

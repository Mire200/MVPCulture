'use client';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker } from 'react-leaflet';
import { Fragment, useEffect, useId, useRef } from 'react';
import L from 'leaflet';

const TargetIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50%;background:radial-gradient(circle,#22ff88 0 40%,transparent 60%);box-shadow:0 0 12px #22ff88"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface Props {
  target: { lat: number; lng: number; label: string };
  players: Array<{
    id: string;
    nickname: string;
    color: string;
    lat?: number;
    lng?: number;
    distanceKm?: number;
  }>;
  /** Clé logique (ex: id de la question) : change => remount complet. */
  resetKey?: string | number;
}

export function RevealMap({ target, players, resetKey }: Props) {
  const placed = players.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
  const lats = [target.lat, ...placed.map((p) => p.lat as number)];
  const lngs = [target.lng, ...placed.map((p) => p.lng as number)];
  const bounds = placed.length
    ? L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ).pad(0.3)
    : undefined;

  const fallbackId = useId();
  const mapKey = `${resetKey ?? fallbackId}`;
  const rootRef = useRef<HTMLDivElement | null>(null);

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
    <div ref={rootRef} className="rounded-2xl overflow-hidden ring-1 ring-white/10">
      <div style={{ height: 280 }} className="w-full">
        <MapContainer
          key={mapKey}
          {...(bounds
            ? { bounds }
            : { center: [target.lat, target.lng] as [number, number], zoom: 4 })}
          worldCopyJump
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; OSM'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <Marker position={[target.lat, target.lng]} icon={TargetIcon} />
          {placed.map((p) => (
            <Fragment key={p.id}>
              <CircleMarker
                center={[p.lat as number, p.lng as number]}
                radius={7}
                pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.9, weight: 2 }}
              />
              <Polyline
                positions={[
                  [p.lat as number, p.lng as number],
                  [target.lat, target.lng],
                ]}
                pathOptions={{ color: p.color, opacity: 0.35, weight: 1.5, dashArray: '4 4' }}
              />
            </Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import Map, {
  Layer,
  Marker,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre';
import type { FeatureCollection, LineString } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';
import { neonMapStyle } from '../round/mapStyle';
import { MapMarker } from '../round/MapMarker';
import {
  BowlingVideoOverlay,
  pickBowlingKind,
  pickBowlingSrc,
  type BowlingShown,
} from './BowlingVideoOverlay';

interface PlayerInput {
  id: string;
  nickname: string;
  color: string;
  lat?: number;
  lng?: number;
  distanceKm?: number;
}

interface Props {
  target: { lat: number; lng: number; label: string };
  players: PlayerInput[];
  /** Nombre de joueurs révélés (>= 0). Si undefined, on montre tout. */
  revealedCount?: number;
  /** Clé logique (ex: id de la question) : change => remount complet. */
  resetKey?: string | number;
  /** Appelé lorsqu'une vidéo bowling démarre / se termine, pour que le parent
   *  puisse mettre en pause la séquence de reveal le temps de la lecture. */
  onBowlingStateChange?: (active: boolean) => void;
}

const FLIGHT_DURATION_MS = 2100;
const EMPTY_FC: FeatureCollection<LineString> = { type: 'FeatureCollection', features: [] };

export function RevealMap({
  target,
  players,
  revealedCount,
  resetKey,
  onBowlingStateChange,
}: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const flightTokenRef = useRef<{ cancelled: boolean } | null>(null);
  const [flightProgress, setFlightProgress] = useState<number | null>(null);
  const [hud, setHud] = useState<{
    nickname: string;
    color: string;
    km: number;
    total: number;
  } | null>(null);
  const [bowling, setBowling] = useState<BowlingShown | null>(null);

  const placed = useMemo(
    () => players.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number'),
    [players],
  );

  const visiblePlayers = useMemo(() => {
    if (revealedCount === undefined) return placed;
    return placed.slice(0, Math.max(0, revealedCount));
  }, [placed, revealedCount]);

  // Lignes complètes pour les joueurs dont le vol est terminé.
  const staticLines: FeatureCollection<LineString> = useMemo(() => {
    const upTo =
      flightProgress !== null
        ? Math.max(0, visiblePlayers.length - 1)
        : visiblePlayers.length;
    return {
      type: 'FeatureCollection',
      features: visiblePlayers.slice(0, upTo).map((p) => ({
        type: 'Feature',
        id: p.id,
        properties: { color: p.color, playerId: p.id },
        geometry: {
          type: 'LineString',
          coordinates: [
            [p.lng as number, p.lat as number],
            [target.lng, target.lat],
          ],
        },
      })),
    };
  }, [visiblePlayers, flightProgress, target.lng, target.lat]);

  // Ligne en cours de tracé : part du joueur et avance jusqu'à la cible.
  const flightLine: FeatureCollection<LineString> = useMemo(() => {
    if (flightProgress === null) return EMPTY_FC;
    const last = visiblePlayers[visiblePlayers.length - 1];
    if (!last || typeof last.lat !== 'number' || typeof last.lng !== 'number') {
      return EMPTY_FC;
    }
    const t = flightProgress;
    const endLng = (last.lng as number) + (target.lng - (last.lng as number)) * t;
    const endLat = (last.lat as number) + (target.lat - (last.lat as number)) * t;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: `flight-${last.id}`,
          properties: { color: last.color },
          geometry: {
            type: 'LineString',
            coordinates: [
              [last.lng as number, last.lat as number],
              [endLng, endLat],
            ],
          },
        },
      ],
    };
  }, [flightProgress, visiblePlayers, target.lng, target.lat]);

  // Position initiale : vue large, légère inclinaison.
  useEffect(() => {
    const m = mapRef.current?.getMap();
    if (!m) return;
    if (revealedCount !== undefined && revealedCount > 0) return;
    m.easeTo({
      center: [target.lng, target.lat],
      zoom: 2.6,
      pitch: 35,
      bearing: 0,
      duration: 900,
    });
  }, [target.lng, target.lat, revealedCount]);

  // Chorégraphie : pour chaque nouveau joueur révélé, vol caméra + tracé + km.
  useEffect(() => {
    const m = mapRef.current?.getMap();
    if (!m || revealedCount === undefined) return;
    if (revealedCount <= 0) {
      setHud(null);
      setFlightProgress(null);
      return;
    }
    const last = visiblePlayers[visiblePlayers.length - 1];
    if (!last || typeof last.lat !== 'number' || typeof last.lng !== 'number') return;

    if (flightTokenRef.current) flightTokenRef.current.cancelled = true;
    const token = { cancelled: false };
    flightTokenRef.current = token;

    const pLng = last.lng as number;
    const pLat = last.lat as number;
    const bearingDeg = bearing(pLat, pLng, target.lat, target.lng);
    const distance =
      typeof last.distanceKm === 'number' && Number.isFinite(last.distanceKm)
        ? last.distanceKm
        : haversineKm(pLat, pLng, target.lat, target.lng);
    const zoom = zoomForDistance(distance);

    setHud({ nickname: last.nickname, color: last.color, km: 0, total: distance });
    setFlightProgress(0);

    let rafId = 0;

    const run = async () => {
      m.easeTo({
        center: [pLng, pLat],
        zoom,
        pitch: 60,
        bearing: bearingDeg,
        duration: 600,
        essential: true,
      });
      await sleep(600);
      if (token.cancelled) return;

      // Pour les distances courtes on reste "collé" au sol (easeTo linéaire).
      // Pour les longues distances on garde un petit arc visuel, mais sans
      // dézoomer exagérément (curve = 0.9 reste proche d'un pan).
      if (distance < 2500) {
        m.easeTo({
          center: [target.lng, target.lat],
          zoom,
          pitch: 60,
          bearing: bearingDeg,
          duration: FLIGHT_DURATION_MS,
          essential: true,
        });
      } else {
        m.flyTo({
          center: [target.lng, target.lat],
          zoom,
          pitch: 60,
          bearing: bearingDeg,
          duration: FLIGHT_DURATION_MS,
          essential: true,
          curve: 0.95,
        });
      }

      const start = performance.now();
      const tick = () => {
        if (token.cancelled) return;
        const t = Math.min(1, (performance.now() - start) / FLIGHT_DURATION_MS);
        const eased = easeOutCubic(t);
        setFlightProgress(t);
        setHud((prev) => (prev ? { ...prev, km: prev.total * eased } : prev));
        if (t < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          setFlightProgress(null);
          setHud((prev) => (prev ? { ...prev, km: prev.total } : prev));
          const kind = pickBowlingKind(distance);
          if (kind) {
            setBowling({
              id: `${last.id}-${revealedCount}-${Date.now()}`,
              kind,
              src: pickBowlingSrc(kind),
            });
          }
        }
      };
      rafId = requestAnimationFrame(tick);
    };
    run();

    return () => {
      token.cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount]);

  // Si la question change, on nettoie l'overlay bowling en route.
  useEffect(() => {
    setBowling(null);
  }, [resetKey]);

  // Quand tous les joueurs sont révélés, on cadre l'ensemble.
  const totalPlaced = placed.length;
  useEffect(() => {
    const m = mapRef.current?.getMap();
    if (!m || revealedCount === undefined) return;
    if (totalPlaced === 0 || revealedCount < totalPlaced) return;
    // On laisse le compteur final visible un long moment avant de dézoomer
    // pour cadrer la vue d'ensemble, puis encore quelques secondes après.
    const fitTimeout = setTimeout(() => {
      const lats = [target.lat, ...placed.map((p) => p.lat as number)];
      const lngs = [target.lng, ...placed.map((p) => p.lng as number)];
      const south = Math.min(...lats);
      const north = Math.max(...lats);
      const west = Math.min(...lngs);
      const east = Math.max(...lngs);
      m.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 90, pitch: 35, duration: 1600, curve: 1.25, maxZoom: 7, essential: true },
      );
    }, 2400);
    const clearTimeoutId = setTimeout(() => {
      setHud(null);
    }, 6000);
    return () => {
      clearTimeout(fitTimeout);
      clearTimeout(clearTimeoutId);
    };
  }, [revealedCount, totalPlaced, placed, target.lat, target.lng]);

  // Marching ants sur les lignes complètes (décoratif).
  useEffect(() => {
    const m = mapRef.current?.getMap();
    if (!m) return;
    const patterns: Array<[number, number]> = [
      [0.1, 4],
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
      [4, 3],
      [4, 2],
      [4, 1],
      [4, 0.1],
    ];
    let raf = 0;
    let last = performance.now();
    let idx = 0;
    const apply = () => {
      if (!m.getLayer('static-lines')) return;
      try {
        m.setPaintProperty('static-lines', 'line-dasharray', patterns[idx]);
      } catch {
      }
    };
    const loop = (now: number) => {
      if (now - last > 70) {
        idx = (idx + 1) % patterns.length;
        apply();
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    apply();
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-white/10">
      <div className="mvpc-map-shell relative" style={{ height: 420 }}>
        <Map
          ref={mapRef}
          key={resetKey}
          mapStyle={neonMapStyle}
          initialViewState={{
            longitude: target.lng,
            latitude: target.lat,
            zoom: 2.6,
            pitch: 35,
            bearing: 0,
          }}
          attributionControl={false}
          dragRotate={false}
          pitchWithRotate={false}
          touchPitch={false}
          interactive
          renderWorldCopies
          maxZoom={10}
          minZoom={1}
          maxPitch={75}
        >
          <Source id="static-lines-src" type="geojson" data={staticLines}>
            <Layer
              id="static-lines-glow"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 8,
                'line-opacity': 0.22,
                'line-blur': 5,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="static-lines"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 2.2,
                'line-opacity': 0.9,
                'line-dasharray': [2, 2.5],
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>

          <Source id="flight-line-src" type="geojson" data={flightLine}>
            <Layer
              id="flight-line-glow"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 14,
                'line-opacity': 0.35,
                'line-blur': 8,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="flight-line-core"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': 3.6,
                'line-opacity': 1,
              }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </Source>

          <Marker
            longitude={target.lng}
            latitude={target.lat}
            anchor="bottom"
            style={{ pointerEvents: 'none' }}
          >
            <MapMarker variant="target" beam beamScale={1.1} />
          </Marker>

          {visiblePlayers.map((p) => (
            <Marker
              key={p.id}
              longitude={p.lng as number}
              latitude={p.lat as number}
              anchor="bottom"
              style={{ pointerEvents: 'none' }}
            >
              <MapMarker variant="player" color={p.color} beam />
            </Marker>
          ))}
        </Map>

        {hud && (
          <div
            className="mvpc-km-hud"
            style={{ ['--mm-color' as string]: hud.color }}
          >
            <span className="mvpc-km-hud__dot" />
            <span className="mvpc-km-hud__name">{hud.nickname}</span>
            <span className="mvpc-km-hud__value">{Math.round(hud.km).toLocaleString('fr-FR')}</span>
            <span className="mvpc-km-hud__unit">km</span>
          </div>
        )}

        <BowlingVideoOverlay
          shown={bowling}
          onOpen={() => onBowlingStateChange?.(true)}
          onDone={(id) => {
            setBowling((prev) => (prev && prev.id === id ? null : prev));
            onBowlingStateChange?.(false);
          }}
        />

        <div className="mvpc-map-aurora" aria-hidden />
      </div>
    </div>
  );
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}
function toDeg(r: number) {
  return (r * 180) / Math.PI;
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function zoomForDistance(km: number): number {
  // Zoom volontairement serré : on préfère voir la route en détail, quitte à
  // ce que les deux extrémités soient hors champ au début / à la fin.
  if (km < 5) return 12;
  if (km < 20) return 10.5;
  if (km < 60) return 9.2;
  if (km < 150) return 8.2;
  if (km < 400) return 7.2;
  if (km < 900) return 6.3;
  if (km < 1800) return 5.5;
  if (km < 3500) return 4.7;
  if (km < 6500) return 4.0;
  if (km < 10000) return 3.4;
  return 2.9;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

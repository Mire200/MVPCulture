'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import Map, { Marker, NavigationControl, type MapRef, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import { useCallback, useEffect, useRef } from 'react';
import { neonMapStyle } from './mapStyle';
import { MapMarker } from './MapMarker';

interface Props {
  value: { lat: number; lng: number } | null;
  onChange: (c: { lat: number; lng: number }) => void;
  readOnly?: boolean;
  height?: number;
  /** Remplit le conteneur parent à 100% au lieu d'utiliser `height`. */
  fill?: boolean;
  /** Couleur d'accent du marqueur joueur (avatar color). */
  color?: string;
  /** Clé logique (ex: id de la question) : change => reset du viewport. */
  resetKey?: string | number;
}

export function MapPicker({ value, onChange, readOnly, height = 360, fill, color, resetKey }: Props) {
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    const m = mapRef.current?.getMap();
    if (!m) return;
    m.easeTo({ center: [10, 25], zoom: 1.6, duration: 900, easing: easeInOutCubic });
  }, [resetKey]);

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (readOnly) return;
      const { lng, lat } = e.lngLat;
      onChange({ lat, lng });
      const m = mapRef.current?.getMap();
      if (m) {
        const current = m.getZoom();
        m.flyTo({
          center: [lng, lat],
          zoom: current < 3 ? 3.2 : current,
          duration: 900,
          essential: true,
          curve: 1.35,
          easing: easeOutCubic,
        });
      }
    },
    [readOnly, onChange],
  );

  return (
    <div
      style={fill ? undefined : { height }}
      className={`mvpc-map-shell relative ${fill ? 'w-full h-full absolute inset-0' : 'w-full'}`}
    >
      <Map
        ref={mapRef}
        mapStyle={neonMapStyle}
        initialViewState={{ longitude: 10, latitude: 25, zoom: 1.6 }}
        onClick={handleClick}
        attributionControl={false}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        cursor={readOnly ? 'not-allowed' : 'crosshair'}
        renderWorldCopies
        maxZoom={10}
        minZoom={1}
      >
        <NavigationControl
          position="top-right"
          showCompass={false}
          showZoom
          visualizePitch={false}
        />
        {value && (
          <Marker
            longitude={value.lng}
            latitude={value.lat}
            anchor="bottom"
            style={{ pointerEvents: 'none' }}
          >
            <MapMarker variant="player" color={color} />
          </Marker>
        )}
      </Map>
      <div className="mvpc-map-aurora" aria-hidden />
    </div>
  );
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

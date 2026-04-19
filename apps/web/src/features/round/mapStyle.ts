import type { StyleSpecification } from 'maplibre-gl';

const NEON_VIOLET = '#a855f7';
const NEON_CYAN = '#22d3ee';
const NEON_MAGENTA = '#ec4899';

const WATER_DEEP = '#020617';
const WATER_EDGE = '#0b1230';

const LAND_DEEP = '#1a1240';
const LAND_BRIGHT = '#2a1a5e';
const LAND_GLOW = '#3a1f7a';

export const OPEN_FREE_MAP_TILES = 'https://tiles.openfreemap.org/planet';

/**
 * Style MapLibre dark neon fait main, assorti aux variables CSS du site
 * (`--bg-deep`, `--neon-violet`, `--neon-cyan`, ...).
 *
 * Pensé pour un jeu de type "Place sur la carte" : aucun label (pays/villes)
 * pour ne rien divulguer, mais côtes et frontières bien visibles et lumineuses.
 *
 * Source vectorielle : OpenFreeMap (schéma OpenMapTiles, pas de token requis).
 */
export const neonMapStyle: StyleSpecification = {
  version: 8,
  name: 'MVPC Neon',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: OPEN_FREE_MAP_TILES,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': WATER_DEEP },
    },

    // --- TERRES -------------------------------------------------------------
    {
      id: 'land_base',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      paint: {
        'fill-color': LAND_DEEP,
        'fill-opacity': 1,
      },
    },
    {
      id: 'landuse_bright',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      paint: {
        'fill-color': LAND_BRIGHT,
        'fill-opacity': 0.45,
      },
    },

    // --- EAU ----------------------------------------------------------------
    // Un halo glow derrière les côtes pour bien détacher les continents.
    {
      id: 'water_glow',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'water',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': NEON_CYAN,
        'line-opacity': 0.18,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          1, 1.2,
          4, 3,
          8, 6,
        ],
        'line-blur': [
          'interpolate', ['linear'], ['zoom'],
          1, 1.5,
          4, 3,
          8, 6,
        ],
      },
    },
    {
      id: 'water_fill',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: {
        'fill-color': WATER_DEEP,
        'fill-opacity': 1,
      },
    },
    {
      id: 'water_coastline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'water',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': NEON_CYAN,
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          1, 0.55,
          4, 0.75,
          8, 0.85,
        ],
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          1, 0.6,
          4, 1.1,
          8, 1.6,
        ],
      },
    },

    // --- WATERWAYS (rivières) ----------------------------------------------
    {
      id: 'waterways',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      minzoom: 4,
      paint: {
        'line-color': NEON_CYAN,
        'line-opacity': 0.35,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          4, 0.4,
          10, 1.6,
        ],
      },
    },

    // --- FRONTIÈRES ---------------------------------------------------------
    {
      id: 'boundary_country_glow',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': NEON_MAGENTA,
        'line-opacity': 0.35,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          1, 3,
          4, 5,
          8, 9,
        ],
        'line-blur': 4,
      },
    },
    {
      id: 'boundary_country',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': NEON_VIOLET,
        'line-opacity': 0.9,
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          1, 0.7,
          4, 1.1,
          8, 1.8,
        ],
      },
    },
    {
      id: 'boundary_region',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      minzoom: 4,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': NEON_VIOLET,
        'line-opacity': 0.35,
        'line-width': 0.6,
        'line-dasharray': [3, 3],
      },
    },

    // --- EFFET LUMIÈRE GLOBAL -----------------------------------------------
    // Une nappe légère violette sur les grandes zones terrestres pour le "plus
    // de lumière" sans polluer le visuel.
    {
      id: 'land_sheen',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      paint: {
        'fill-color': LAND_GLOW,
        'fill-opacity': 0.12,
      },
    },
  ],
};

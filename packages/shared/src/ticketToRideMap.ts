export interface TTRCity {
  id: string;
  name: string;
  x: number; // 0–100 (ratio de la viewBox — fallback pour la France)
  y: number;
  lon?: number;
  lat?: number;
}

/** Point géographique simplifié utilisé par les cartes lon/lat. */
export type TTRGeoPoint = [number, number]; // [lon, lat]

export interface TTRMapCity {
  id: string;
  name: string;
  lon: number;
  lat: number;
  /** Décalage du label (unités viewBox 0–100). */
  label?: { x: number; y: number; anchor?: 'start' | 'middle' | 'end' };
}

export interface TTRMapBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  padX: number;
  padY: number;
}

export interface TTRMap {
  id: TtrMapId;
  name: string;
  emoji: string;
  subtitle: string;
  bounds: TTRMapBounds;
  outline: TTRGeoPoint[];
  regionLines: TTRGeoPoint[][];
  cities: TTRMapCity[];
  routes: TTRRoute[];
  destinations: TTRDestination[];
  /** Optionnel : nombre de wagons par joueur si la carte le surcharge. */
  trainsPerPlayer?: number;
}

export const TTR_MAP_IDS = ['france', 'europe', 'usa'] as const;
export type TtrMapId = (typeof TTR_MAP_IDS)[number];
export const DEFAULT_TTR_MAP_ID: TtrMapId = 'france';

export const TTR_CARD_COLORS = [
  'red',
  'blue',
  'green',
  'yellow',
  'black',
  'white',
  'orange',
  'pink',
] as const;
export type TtrCardColor = (typeof TTR_CARD_COLORS)[number];

/** Couleur d'une carte wagon : 8 couleurs + locomotive (joker). */
export type TtrCard = TtrCardColor | 'loco';

/** Couleur d'un tronçon : 8 couleurs + `gray` (n'importe quelle couleur unique). */
export type TtrRouteColor = TtrCardColor | 'gray';

export interface TTRRoute {
  id: string;
  cityA: string;
  cityB: string;
  color: TtrRouteColor;
  length: number; // 1-6
}

export interface TTRDestination {
  id: string;
  cityA: string;
  cityB: string;
  points: number;
}

/** Points gagnés par tronçon capturé, selon la longueur (règles officielles). */
export const TTR_ROUTE_POINTS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 10,
  6: 15,
};

/** Nombre de wagons de départ par joueur (règles officielles). */
export const TTR_TRAINS_PER_PLAYER = 45;
/** Taille du marché de cartes face visible. */
export const TTR_MARKET_SIZE = 5;
/** Seuil de locomotives pour déclencher un reshuffle du marché. */
export const TTR_MARKET_LOCO_RESHUFFLE = 3;
/** Nombre de cartes de chaque couleur dans la pioche initiale. */
export const TTR_CARDS_PER_COLOR = 12;
/** Nombre de locomotives dans la pioche initiale. */
export const TTR_LOCOMOTIVES_IN_DECK = 14;
/** Au départ : piocher 3 billets destination, en garder au moins 2. */
export const TTR_INITIAL_DESTINATIONS_DRAW = 3;
export const TTR_INITIAL_DESTINATIONS_KEEP_MIN = 2;
/** En cours de partie : piocher 3 billets, en garder au moins 1. */
export const TTR_MIDGAME_DESTINATIONS_DRAW = 3;
export const TTR_MIDGAME_DESTINATIONS_KEEP_MIN = 1;
/** Seuil de wagons restants qui déclenche le dernier tour de chaque joueur. */
export const TTR_LAST_ROUND_TRAIN_THRESHOLD = 2;
/** Bonus "Plus Long Chemin" (distribué à tout le monde en cas d'égalité). */
export const TTR_LONGEST_PATH_BONUS = 10;

export const TTR_CITIES: TTRCity[] = [
  { id: 'paris', name: 'Paris', x: 45, y: 25 },
  { id: 'lille', name: 'Lille', x: 48, y: 10 },
  { id: 'strasbourg', name: 'Strasbourg', x: 80, y: 25 },
  { id: 'lyon', name: 'Lyon', x: 65, y: 55 },
  { id: 'marseille', name: 'Marseille', x: 70, y: 80 },
  { id: 'nice', name: 'Nice', x: 85, y: 75 },
  { id: 'toulouse', name: 'Toulouse', x: 45, y: 80 },
  { id: 'bordeaux', name: 'Bordeaux', x: 30, y: 65 },
  { id: 'nantes', name: 'Nantes', x: 25, y: 45 },
  { id: 'brest', name: 'Brest', x: 5, y: 35 },
  { id: 'rennes', name: 'Rennes', x: 20, y: 38 },
  { id: 'rouen', name: 'Rouen', x: 40, y: 20 },
  { id: 'dijon', name: 'Dijon', x: 65, y: 40 },
  { id: 'clermont', name: 'Clermont-Ferrand', x: 55, y: 60 },
  { id: 'montpellier', name: 'Montpellier', x: 60, y: 80 },
];

export const TTR_ROUTES: TTRRoute[] = [
  { id: 'r1', cityA: 'paris', cityB: 'lille', color: 'red', length: 2 },
  { id: 'r2', cityA: 'paris', cityB: 'rouen', color: 'white', length: 2 },
  { id: 'r3', cityA: 'paris', cityB: 'dijon', color: 'yellow', length: 3 },
  { id: 'r4', cityA: 'paris', cityB: 'lyon', color: 'blue', length: 4 },
  { id: 'r5', cityA: 'paris', cityB: 'nantes', color: 'green', length: 4 },
  { id: 'r6', cityA: 'lille', cityB: 'rouen', color: 'gray', length: 2 },
  { id: 'r7', cityA: 'rouen', cityB: 'rennes', color: 'orange', length: 3 },
  { id: 'r8', cityA: 'rennes', cityB: 'brest', color: 'green', length: 2 },
  { id: 'r9', cityA: 'rennes', cityB: 'nantes', color: 'gray', length: 1 },
  { id: 'r10', cityA: 'nantes', cityB: 'bordeaux', color: 'red', length: 4 },
  { id: 'r11', cityA: 'bordeaux', cityB: 'toulouse', color: 'black', length: 2 },
  { id: 'r12', cityA: 'toulouse', cityB: 'montpellier', color: 'pink', length: 2 },
  { id: 'r13', cityA: 'montpellier', cityB: 'marseille', color: 'yellow', length: 1 },
  { id: 'r14', cityA: 'marseille', cityB: 'nice', color: 'gray', length: 2 },
  { id: 'r15', cityA: 'lyon', cityB: 'marseille', color: 'blue', length: 3 },
  { id: 'r16', cityA: 'lyon', cityB: 'montpellier', color: 'red', length: 3 },
  { id: 'r17', cityA: 'lyon', cityB: 'clermont', color: 'black', length: 1 },
  { id: 'r18', cityA: 'clermont', cityB: 'toulouse', color: 'green', length: 3 },
  { id: 'r19', cityA: 'clermont', cityB: 'bordeaux', color: 'orange', length: 2 },
  { id: 'r20', cityA: 'dijon', cityB: 'strasbourg', color: 'pink', length: 2 },
  { id: 'r21', cityA: 'dijon', cityB: 'lyon', color: 'white', length: 2 },
  { id: 'r22', cityA: 'strasbourg', cityB: 'paris', color: 'gray', length: 4 },
];

export const TTR_DESTINATIONS: TTRDestination[] = [
  { id: 'd1', cityA: 'brest', cityB: 'nice', points: 20 },
  { id: 'd2', cityA: 'paris', cityB: 'marseille', points: 8 },
  { id: 'd3', cityA: 'lille', cityB: 'toulouse', points: 11 },
  { id: 'd4', cityA: 'bordeaux', cityB: 'strasbourg', points: 13 },
  { id: 'd5', cityA: 'nantes', cityB: 'nice', points: 14 },
  { id: 'd6', cityA: 'paris', cityB: 'brest', points: 6 },
  { id: 'd7', cityA: 'rennes', cityB: 'montpellier', points: 9 },
  { id: 'd8', cityA: 'lyon', cityB: 'bordeaux', points: 6 },
  { id: 'd9', cityA: 'dijon', cityB: 'nantes', points: 8 },
  { id: 'd10', cityA: 'toulouse', cityB: 'paris', points: 7 },
  { id: 'd11', cityA: 'clermont', cityB: 'strasbourg', points: 7 },
  { id: 'd12', cityA: 'marseille', cityB: 'rennes', points: 12 },
  { id: 'd13', cityA: 'lille', cityB: 'nice', points: 16 },
  { id: 'd14', cityA: 'brest', cityB: 'strasbourg', points: 15 },
  { id: 'd15', cityA: 'rouen', cityB: 'marseille', points: 10 },
  { id: 'd16', cityA: 'nantes', cityB: 'lyon', points: 8 },
  { id: 'd17', cityA: 'bordeaux', cityB: 'marseille', points: 8 },
  { id: 'd18', cityA: 'lille', cityB: 'bordeaux', points: 10 },
  { id: 'd19', cityA: 'strasbourg', cityB: 'nice', points: 11 },
  { id: 'd20', cityA: 'brest', cityB: 'toulouse', points: 12 },
  { id: 'd21', cityA: 'paris', cityB: 'nice', points: 12 },
  { id: 'd22', cityA: 'rennes', cityB: 'lyon', points: 7 },
  { id: 'd23', cityA: 'dijon', cityB: 'marseille', points: 7 },
  { id: 'd24', cityA: 'rouen', cityB: 'montpellier', points: 10 },
  { id: 'd25', cityA: 'clermont', cityB: 'lille', points: 8 },
  { id: 'd26', cityA: 'nantes', cityB: 'strasbourg', points: 12 },
  { id: 'd27', cityA: 'bordeaux', cityB: 'nice', points: 11 },
  { id: 'd28', cityA: 'brest', cityB: 'marseille', points: 18 },
  { id: 'd29', cityA: 'lille', cityB: 'montpellier', points: 13 },
  { id: 'd30', cityA: 'rouen', cityB: 'toulouse', points: 9 },
];

// ---------------------------------------------------------------------------
// Cartes : France (officielle), Europe & USA (sélections curatées).
// ---------------------------------------------------------------------------

const FRANCE_BOUNDS: TTRMapBounds = {
  minLon: -5.8,
  maxLon: 8.9,
  minLat: 41.25,
  maxLat: 51.25,
  padX: 6.5,
  padY: 5.5,
};

const FRANCE_OUTLINE: TTRGeoPoint[] = [
  [-4.78, 48.44],
  [-4.15, 48.08],
  [-3.58, 48.78],
  [-2.25, 48.78],
  [-1.62, 49.66],
  [-0.18, 49.42],
  [1.08, 50.07],
  [2.82, 50.78],
  [4.15, 50.43],
  [4.82, 49.9],
  [6.15, 49.48],
  [7.45, 48.72],
  [7.65, 47.6],
  [6.75, 46.92],
  [6.95, 46.18],
  [6.6, 45.36],
  [7.18, 44.48],
  [7.62, 43.78],
  [7.18, 43.3],
  [5.9, 43.08],
  [4.66, 43.34],
  [3.08, 42.82],
  [1.55, 42.45],
  [0.35, 42.68],
  [-0.78, 43.05],
  [-1.54, 43.43],
  [-1.23, 44.35],
  [-1.12, 45.28],
  [-1.18, 46.12],
  [-1.78, 46.85],
  [-2.92, 47.48],
  [-4.25, 47.82],
  [-5.05, 48.12],
  [-4.78, 48.44],
];

const FRANCE_REGION_LINES: TTRGeoPoint[][] = [
  [
    [-4.4, 48.1],
    [-2.0, 47.8],
    [0.1, 47.4],
    [2.3, 47.1],
    [4.9, 47.3],
    [7.4, 48.2],
  ],
  [
    [-1.3, 49.3],
    [0.8, 48.6],
    [2.35, 48.85],
    [4.8, 47.6],
    [6.7, 46.4],
  ],
  [
    [-1.2, 44.8],
    [1.4, 44.1],
    [3.1, 43.9],
    [5.4, 43.3],
    [7.2, 43.7],
  ],
  [
    [2.9, 50.5],
    [2.35, 48.85],
    [3.08, 45.78],
    [3.88, 43.61],
  ],
];

const FRANCE_MAP_CITIES: TTRMapCity[] = [
  { id: 'paris', name: 'Paris', lon: 2.3522, lat: 48.8566, label: { x: 2.8, y: -2.6, anchor: 'start' } },
  { id: 'lille', name: 'Lille', lon: 3.0573, lat: 50.6292, label: { x: 0, y: -4 } },
  { id: 'strasbourg', name: 'Strasbourg', lon: 7.7521, lat: 48.5734, label: { x: -2.6, y: -3.1, anchor: 'end' } },
  { id: 'lyon', name: 'Lyon', lon: 4.8357, lat: 45.764, label: { x: 3, y: -2.4, anchor: 'start' } },
  { id: 'marseille', name: 'Marseille', lon: 5.3698, lat: 43.2965, label: { x: 0, y: 4.4 } },
  { id: 'nice', name: 'Nice', lon: 7.262, lat: 43.7102, label: { x: 2.6, y: 1.1, anchor: 'start' } },
  { id: 'toulouse', name: 'Toulouse', lon: 1.4442, lat: 43.6047, label: { x: -2.8, y: 4.2, anchor: 'end' } },
  { id: 'bordeaux', name: 'Bordeaux', lon: -0.5792, lat: 44.8378, label: { x: -3.4, y: 1.2, anchor: 'end' } },
  { id: 'nantes', name: 'Nantes', lon: -1.5536, lat: 47.2184, label: { x: -3.4, y: 1.3, anchor: 'end' } },
  { id: 'brest', name: 'Brest', lon: -4.4861, lat: 48.3904, label: { x: 2.8, y: -2.6, anchor: 'start' } },
  { id: 'rennes', name: 'Rennes', lon: -1.6778, lat: 48.1173, label: { x: -2.8, y: -3.2, anchor: 'end' } },
  { id: 'rouen', name: 'Rouen', lon: 1.0993, lat: 49.4432, label: { x: -2.8, y: -3.4, anchor: 'end' } },
  { id: 'dijon', name: 'Dijon', lon: 5.0415, lat: 47.322, label: { x: 3.1, y: -2.9, anchor: 'start' } },
  { id: 'clermont', name: 'Clermont-Ferrand', lon: 3.087, lat: 45.7772, label: { x: -3.2, y: 0.6, anchor: 'end' } },
  { id: 'montpellier', name: 'Montpellier', lon: 3.8767, lat: 43.6108, label: { x: -3.2, y: 4.1, anchor: 'end' } },
];

export const FRANCE_MAP: TTRMap = {
  id: 'france',
  name: 'France',
  emoji: '🇫🇷',
  subtitle: 'Réseau hexagonal · 15 villes · 22 tronçons',
  bounds: FRANCE_BOUNDS,
  outline: FRANCE_OUTLINE,
  regionLines: FRANCE_REGION_LINES,
  cities: FRANCE_MAP_CITIES,
  routes: TTR_ROUTES,
  destinations: TTR_DESTINATIONS,
  trainsPerPlayer: TTR_TRAINS_PER_PLAYER,
};

// ---------- EUROPE ----------

const EUROPE_BOUNDS: TTRMapBounds = {
  minLon: -10,
  maxLon: 40,
  minLat: 36,
  maxLat: 62,
  padX: 4.5,
  padY: 4.5,
};

const EUROPE_OUTLINE: TTRGeoPoint[] = [
  [-9.5, 43.5],
  [-9.0, 50.5],
  [-5.5, 55.5],
  [-2.5, 58.5],
  [1.0, 60.5],
  [10.0, 58.5],
  [18.0, 60.5],
  [24.0, 60.0],
  [30.0, 60.0],
  [36.0, 56.0],
  [38.0, 50.0],
  [36.0, 44.0],
  [30.0, 41.0],
  [23.0, 39.0],
  [18.0, 40.0],
  [12.0, 38.0],
  [7.0, 38.0],
  [2.0, 39.0],
  [-5.5, 36.0],
  [-9.5, 38.0],
  [-9.5, 43.5],
];

const EUROPE_CITIES: TTRMapCity[] = [
  { id: 'londres', name: 'Londres', lon: -0.1276, lat: 51.5074, label: { x: -2.2, y: -2.8, anchor: 'end' } },
  { id: 'edimbourg', name: 'Édimbourg', lon: -3.19, lat: 55.95, label: { x: -2.4, y: -2.8, anchor: 'end' } },
  { id: 'amsterdam', name: 'Amsterdam', lon: 4.9041, lat: 52.3676, label: { x: 0, y: -4 } },
  { id: 'paris', name: 'Paris', lon: 2.3522, lat: 48.8566, label: { x: -2.6, y: -2.8, anchor: 'end' } },
  { id: 'madrid', name: 'Madrid', lon: -3.7038, lat: 40.4168, label: { x: 0, y: 4 } },
  { id: 'barcelone', name: 'Barcelone', lon: 2.1734, lat: 41.3851, label: { x: 2.6, y: 2.4, anchor: 'start' } },
  { id: 'lisbonne', name: 'Lisbonne', lon: -9.1393, lat: 38.7223, label: { x: 0, y: 4 } },
  { id: 'rome', name: 'Rome', lon: 12.4964, lat: 41.9028, label: { x: 2.6, y: 2.4, anchor: 'start' } },
  { id: 'zurich', name: 'Zurich', lon: 8.5417, lat: 47.3769, label: { x: 0, y: -3.8 } },
  { id: 'berlin', name: 'Berlin', lon: 13.405, lat: 52.52, label: { x: 0, y: -3.8 } },
  { id: 'munich', name: 'Munich', lon: 11.582, lat: 48.1351, label: { x: 0, y: 4 } },
  { id: 'vienne', name: 'Vienne', lon: 16.3738, lat: 48.2082, label: { x: 2.6, y: 2.4, anchor: 'start' } },
  { id: 'varsovie', name: 'Varsovie', lon: 21.0122, lat: 52.2297, label: { x: 2.6, y: 1.2, anchor: 'start' } },
  { id: 'stockholm', name: 'Stockholm', lon: 18.0686, lat: 59.3293, label: { x: -2.4, y: -2.4, anchor: 'end' } },
  { id: 'copenhague', name: 'Copenhague', lon: 12.5683, lat: 55.6761, label: { x: 2.4, y: -2.2, anchor: 'start' } },
  { id: 'moscou', name: 'Moscou', lon: 37.6173, lat: 55.7558, label: { x: 0, y: -3.8 } },
  { id: 'kiev', name: 'Kiev', lon: 30.5234, lat: 50.4501, label: { x: 0, y: 4 } },
  { id: 'bucarest', name: 'Bucarest', lon: 26.1025, lat: 44.4268, label: { x: 2.6, y: 1.2, anchor: 'start' } },
  { id: 'istanbul', name: 'Istanbul', lon: 28.9784, lat: 41.0082, label: { x: 0, y: 4 } },
  { id: 'athenes', name: 'Athènes', lon: 23.7275, lat: 37.9838, label: { x: 0, y: 4 } },
];

const EUROPE_ROUTES: TTRRoute[] = [
  { id: 'e1', cityA: 'edimbourg', cityB: 'londres', color: 'orange', length: 4 },
  { id: 'e2', cityA: 'londres', cityB: 'amsterdam', color: 'gray', length: 2 },
  { id: 'e3', cityA: 'londres', cityB: 'paris', color: 'pink', length: 2 },
  { id: 'e4', cityA: 'amsterdam', cityB: 'paris', color: 'black', length: 3 },
  { id: 'e5', cityA: 'amsterdam', cityB: 'berlin', color: 'yellow', length: 3 },
  { id: 'e6', cityA: 'paris', cityB: 'zurich', color: 'gray', length: 3 },
  { id: 'e7', cityA: 'paris', cityB: 'barcelone', color: 'gray', length: 4 },
  { id: 'e8', cityA: 'barcelone', cityB: 'madrid', color: 'yellow', length: 2 },
  { id: 'e9', cityA: 'madrid', cityB: 'lisbonne', color: 'pink', length: 3 },
  { id: 'e10', cityA: 'barcelone', cityB: 'rome', color: 'gray', length: 5 },
  { id: 'e11', cityA: 'zurich', cityB: 'munich', color: 'yellow', length: 2 },
  { id: 'e12', cityA: 'zurich', cityB: 'rome', color: 'green', length: 3 },
  { id: 'e13', cityA: 'munich', cityB: 'berlin', color: 'blue', length: 2 },
  { id: 'e14', cityA: 'munich', cityB: 'vienne', color: 'gray', length: 2 },
  { id: 'e15', cityA: 'berlin', cityB: 'varsovie', color: 'pink', length: 3 },
  { id: 'e16', cityA: 'berlin', cityB: 'copenhague', color: 'gray', length: 2 },
  { id: 'e17', cityA: 'copenhague', cityB: 'stockholm', color: 'white', length: 3 },
  { id: 'e18', cityA: 'stockholm', cityB: 'moscou', color: 'gray', length: 6 },
  { id: 'e19', cityA: 'varsovie', cityB: 'moscou', color: 'orange', length: 4 },
  { id: 'e20', cityA: 'varsovie', cityB: 'kiev', color: 'gray', length: 3 },
  { id: 'e21', cityA: 'vienne', cityB: 'varsovie', color: 'blue', length: 2 },
  { id: 'e22', cityA: 'vienne', cityB: 'bucarest', color: 'gray', length: 3 },
  { id: 'e23', cityA: 'bucarest', cityB: 'kiev', color: 'yellow', length: 3 },
  { id: 'e24', cityA: 'bucarest', cityB: 'istanbul', color: 'black', length: 3 },
  { id: 'e25', cityA: 'rome', cityB: 'athenes', color: 'gray', length: 5 },
  { id: 'e26', cityA: 'istanbul', cityB: 'athenes', color: 'pink', length: 4 },
  { id: 'e27', cityA: 'moscou', cityB: 'kiev', color: 'white', length: 3 },
];

const EUROPE_DESTINATIONS: TTRDestination[] = [
  { id: 'eu1', cityA: 'lisbonne', cityB: 'moscou', points: 20 },
  { id: 'eu2', cityA: 'londres', cityB: 'athenes', points: 18 },
  { id: 'eu3', cityA: 'edimbourg', cityB: 'istanbul', points: 17 },
  { id: 'eu4', cityA: 'paris', cityB: 'varsovie', points: 11 },
  { id: 'eu5', cityA: 'madrid', cityB: 'berlin', points: 12 },
  { id: 'eu6', cityA: 'stockholm', cityB: 'rome', points: 14 },
  { id: 'eu7', cityA: 'barcelone', cityB: 'munich', points: 8 },
  { id: 'eu8', cityA: 'amsterdam', cityB: 'vienne', points: 7 },
  { id: 'eu9', cityA: 'berlin', cityB: 'bucarest', points: 8 },
  { id: 'eu10', cityA: 'copenhague', cityB: 'kiev', points: 10 },
  { id: 'eu11', cityA: 'paris', cityB: 'istanbul', points: 13 },
  { id: 'eu12', cityA: 'rome', cityB: 'moscou', points: 12 },
  { id: 'eu13', cityA: 'lisbonne', cityB: 'vienne', points: 11 },
  { id: 'eu14', cityA: 'athenes', cityB: 'varsovie', points: 10 },
  { id: 'eu15', cityA: 'londres', cityB: 'berlin', points: 7 },
];

export const EUROPE_MAP: TTRMap = {
  id: 'europe',
  name: 'Europe',
  emoji: '🇪🇺',
  subtitle: 'Grand Tour · 20 villes · 27 tronçons',
  bounds: EUROPE_BOUNDS,
  outline: EUROPE_OUTLINE,
  regionLines: [],
  cities: EUROPE_CITIES,
  routes: EUROPE_ROUTES,
  destinations: EUROPE_DESTINATIONS,
  trainsPerPlayer: 40,
};

// ---------- USA ----------

const USA_BOUNDS: TTRMapBounds = {
  minLon: -125,
  maxLon: -66,
  minLat: 24,
  maxLat: 50,
  padX: 4.5,
  padY: 5.0,
};

const USA_OUTLINE: TTRGeoPoint[] = [
  [-123.5, 48.5],
  [-122.0, 47.0],
  [-120.0, 39.0],
  [-117.0, 33.0],
  [-114.0, 32.5],
  [-108.0, 31.5],
  [-103.5, 29.0],
  [-99.0, 26.5],
  [-97.5, 26.0],
  [-93.0, 29.0],
  [-89.0, 28.8],
  [-83.5, 28.5],
  [-81.0, 25.0],
  [-80.1, 26.0],
  [-80.5, 30.5],
  [-76.0, 34.5],
  [-74.0, 39.0],
  [-70.0, 41.5],
  [-67.5, 44.5],
  [-67.5, 47.0],
  [-71.0, 47.5],
  [-76.0, 45.0],
  [-82.5, 42.0],
  [-88.0, 48.0],
  [-93.5, 48.5],
  [-96.0, 49.0],
  [-123.5, 49.0],
  [-123.5, 48.5],
];

const USA_CITIES: TTRMapCity[] = [
  { id: 'seattle', name: 'Seattle', lon: -122.3321, lat: 47.6062, label: { x: 0, y: -3.8 } },
  { id: 'sanfran', name: 'San Francisco', lon: -122.4194, lat: 37.7749, label: { x: -2.4, y: 0.4, anchor: 'end' } },
  { id: 'losangeles', name: 'Los Angeles', lon: -118.2437, lat: 34.0522, label: { x: 0, y: 4 } },
  { id: 'phoenix', name: 'Phoenix', lon: -112.074, lat: 33.4484, label: { x: 0, y: 4 } },
  { id: 'saltlake', name: 'Salt Lake City', lon: -111.891, lat: 40.7608, label: { x: 0, y: -3.8 } },
  { id: 'denver', name: 'Denver', lon: -104.9903, lat: 39.7392, label: { x: 2.4, y: 0, anchor: 'start' } },
  { id: 'helena', name: 'Helena', lon: -112.0391, lat: 46.5891, label: { x: 0, y: -3.8 } },
  { id: 'dallas', name: 'Dallas', lon: -96.797, lat: 32.7767, label: { x: 0, y: 4 } },
  { id: 'houston', name: 'Houston', lon: -95.3698, lat: 29.7604, label: { x: 2.6, y: 1.2, anchor: 'start' } },
  { id: 'kansascity', name: 'Kansas City', lon: -94.5786, lat: 39.0997, label: { x: 0, y: -3.8 } },
  { id: 'chicago', name: 'Chicago', lon: -87.6298, lat: 41.8781, label: { x: 2.4, y: 0, anchor: 'start' } },
  { id: 'stlouis', name: 'Saint-Louis', lon: -90.1994, lat: 38.627, label: { x: -2.4, y: 0, anchor: 'end' } },
  { id: 'neworleans', name: 'Nouvelle-Orléans', lon: -90.0715, lat: 29.9511, label: { x: 0, y: 4 } },
  { id: 'atlanta', name: 'Atlanta', lon: -84.388, lat: 33.749, label: { x: 2.4, y: 0, anchor: 'start' } },
  { id: 'miami', name: 'Miami', lon: -80.1918, lat: 25.7617, label: { x: 0, y: 4 } },
  { id: 'washington', name: 'Washington', lon: -77.0369, lat: 38.9072, label: { x: 2.4, y: 0, anchor: 'start' } },
  { id: 'newyork', name: 'New York', lon: -74.006, lat: 40.7128, label: { x: 2.4, y: 0, anchor: 'start' } },
  { id: 'boston', name: 'Boston', lon: -71.0589, lat: 42.3601, label: { x: 2.4, y: 0, anchor: 'start' } },
  { id: 'montreal', name: 'Montréal', lon: -73.5673, lat: 45.5017, label: { x: 0, y: -3.8 } },
  { id: 'toronto', name: 'Toronto', lon: -79.3832, lat: 43.6532, label: { x: 0, y: -3.8 } },
];

const USA_ROUTES: TTRRoute[] = [
  { id: 'u1', cityA: 'seattle', cityB: 'helena', color: 'yellow', length: 6 },
  { id: 'u2', cityA: 'seattle', cityB: 'sanfran', color: 'pink', length: 5 },
  { id: 'u3', cityA: 'sanfran', cityB: 'losangeles', color: 'yellow', length: 3 },
  { id: 'u4', cityA: 'sanfran', cityB: 'saltlake', color: 'orange', length: 5 },
  { id: 'u5', cityA: 'losangeles', cityB: 'phoenix', color: 'gray', length: 3 },
  { id: 'u6', cityA: 'phoenix', cityB: 'dallas', color: 'gray', length: 5 },
  { id: 'u7', cityA: 'phoenix', cityB: 'denver', color: 'white', length: 5 },
  { id: 'u8', cityA: 'saltlake', cityB: 'denver', color: 'red', length: 3 },
  { id: 'u9', cityA: 'saltlake', cityB: 'helena', color: 'pink', length: 3 },
  { id: 'u10', cityA: 'helena', cityB: 'denver', color: 'green', length: 4 },
  { id: 'u11', cityA: 'helena', cityB: 'chicago', color: 'orange', length: 6 },
  { id: 'u12', cityA: 'denver', cityB: 'kansascity', color: 'black', length: 4 },
  { id: 'u13', cityA: 'denver', cityB: 'dallas', color: 'gray', length: 4 },
  { id: 'u14', cityA: 'dallas', cityB: 'houston', color: 'gray', length: 1 },
  { id: 'u15', cityA: 'dallas', cityB: 'kansascity', color: 'black', length: 2 },
  { id: 'u16', cityA: 'houston', cityB: 'neworleans', color: 'gray', length: 2 },
  { id: 'u17', cityA: 'kansascity', cityB: 'chicago', color: 'white', length: 3 },
  { id: 'u18', cityA: 'kansascity', cityB: 'stlouis', color: 'blue', length: 2 },
  { id: 'u19', cityA: 'stlouis', cityB: 'chicago', color: 'green', length: 2 },
  { id: 'u20', cityA: 'stlouis', cityB: 'neworleans', color: 'green', length: 4 },
  { id: 'u21', cityA: 'neworleans', cityB: 'atlanta', color: 'orange', length: 4 },
  { id: 'u22', cityA: 'neworleans', cityB: 'miami', color: 'red', length: 6 },
  { id: 'u23', cityA: 'atlanta', cityB: 'miami', color: 'blue', length: 5 },
  { id: 'u24', cityA: 'atlanta', cityB: 'washington', color: 'gray', length: 4 },
  { id: 'u25', cityA: 'chicago', cityB: 'toronto', color: 'white', length: 4 },
  { id: 'u26', cityA: 'chicago', cityB: 'washington', color: 'orange', length: 4 },
  { id: 'u27', cityA: 'toronto', cityB: 'montreal', color: 'gray', length: 3 },
  { id: 'u28', cityA: 'toronto', cityB: 'boston', color: 'gray', length: 4 },
  { id: 'u29', cityA: 'montreal', cityB: 'boston', color: 'gray', length: 2 },
  { id: 'u30', cityA: 'boston', cityB: 'newyork', color: 'red', length: 2 },
  { id: 'u31', cityA: 'newyork', cityB: 'washington', color: 'orange', length: 2 },
  { id: 'u32', cityA: 'washington', cityB: 'stlouis', color: 'green', length: 4 },
];

const USA_DESTINATIONS: TTRDestination[] = [
  { id: 'us1', cityA: 'seattle', cityB: 'newyork', points: 22 },
  { id: 'us2', cityA: 'losangeles', cityB: 'miami', points: 20 },
  { id: 'us3', cityA: 'sanfran', cityB: 'atlanta', points: 17 },
  { id: 'us4', cityA: 'boston', cityB: 'miami', points: 12 },
  { id: 'us5', cityA: 'chicago', cityB: 'neworleans', points: 7 },
  { id: 'us6', cityA: 'denver', cityB: 'neworleans', points: 8 },
  { id: 'us7', cityA: 'montreal', cityB: 'houston', points: 13 },
  { id: 'us8', cityA: 'toronto', cityB: 'miami', points: 10 },
  { id: 'us9', cityA: 'phoenix', cityB: 'chicago', points: 11 },
  { id: 'us10', cityA: 'saltlake', cityB: 'kansascity', points: 9 },
  { id: 'us11', cityA: 'helena', cityB: 'houston', points: 10 },
  { id: 'us12', cityA: 'washington', cityB: 'dallas', points: 8 },
  { id: 'us13', cityA: 'seattle', cityB: 'dallas', points: 12 },
  { id: 'us14', cityA: 'newyork', cityB: 'atlanta', points: 6 },
  { id: 'us15', cityA: 'chicago', cityB: 'sanfran', points: 13 },
];

export const USA_MAP: TTRMap = {
  id: 'usa',
  name: 'USA',
  emoji: '🇺🇸',
  subtitle: 'Coast to Coast · 20 villes · 32 tronçons',
  bounds: USA_BOUNDS,
  outline: USA_OUTLINE,
  regionLines: [],
  cities: USA_CITIES,
  routes: USA_ROUTES,
  destinations: USA_DESTINATIONS,
  trainsPerPlayer: 45,
};

export const TTR_MAPS: Record<TtrMapId, TTRMap> = {
  france: FRANCE_MAP,
  europe: EUROPE_MAP,
  usa: USA_MAP,
};

export function getTtrMap(id: TtrMapId | string | undefined): TTRMap {
  if (!id) return FRANCE_MAP;
  return TTR_MAPS[id as TtrMapId] ?? FRANCE_MAP;
}

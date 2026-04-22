export interface TTRCity {
  id: string;
  name: string;
  x: number; // 0–100 (ratio de la viewBox)
  y: number;
}

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

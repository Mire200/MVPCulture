import type { Difficulty, GameModeId } from './types.js';

/**
 * Scoring par difficulté (mode classique et par défaut).
 * Jamais de bonus de vitesse : la vitesse ne doit impacter le score que
 * dans les modes qui le déclarent explicitement.
 */
export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 200,
  hard: 400,
};

export const MODE_USES_SPEED: Record<GameModeId, boolean> = {
  classic: false,
  qcm: false,
  estimation: false,
  'list-turns': false, // utilisée seulement en tie-break
  'hot-potato': true,
  'speed-elim': true,
  map: false,
  chronology: false,
  'guess-who': false,
  imposter: false,
  codenames: false,
  wikirace: true,
  'gartic-phone': false,
  bombparty: false,
  'ticket-to-ride': false,
};

export function classicScore(difficulty: Difficulty, correct: boolean): number {
  if (!correct) return 0;
  return DIFFICULTY_POINTS[difficulty];
}

/**
 * Scoring Estimation : classement par proximité absolue à la vraie valeur.
 * Les plus proches gagnent plus de points. Pas de prise en compte de la vitesse.
 */
export function estimationScores(
  answers: Array<{ playerId: string; value: number }>,
  target: number,
  difficulty: Difficulty,
): Record<string, number> {
  if (answers.length === 0) return {};
  const basePool = DIFFICULTY_POINTS[difficulty] * 3;
  const result: Record<string, number> = {};
  const sorted = [...answers].sort(
    (a, b) => Math.abs(a.value - target) - Math.abs(b.value - target),
  );
  // Classement "dense" : tous les joueurs à la même distance de la cible
  // partagent rigoureusement le même score. Deux réponses identiques
  // (ou équidistantes de part et d'autre) donnent ainsi les mêmes points.
  let denseRank = 0;
  let prevDistance: number | null = null;
  for (const entry of sorted) {
    const distance = Math.abs(entry.value - target);
    if (prevDistance !== null && distance !== prevDistance) {
      denseRank += 1;
    }
    prevDistance = distance;
    const decay = Math.pow(0.6, denseRank);
    result[entry.playerId] = Math.round(basePool * decay);
  }
  return result;
}

/**
 * Scoring Liste en tour par tour.
 * Le survivant gagne le gros du pot ; les éliminés gagnent selon l'ordre
 * inverse d'élimination (plus tu tiens, plus tu gagnes).
 */
export function listTurnsScores(params: {
  survivors: string[]; // joueurs jamais éliminés
  eliminationOrder: string[]; // du premier éliminé au dernier
  difficulty: Difficulty;
  correctContributions: Record<string, number>;
}): Record<string, number> {
  const base = DIFFICULTY_POINTS[params.difficulty];
  const result: Record<string, number> = {};
  const allIds = [...params.eliminationOrder, ...params.survivors];
  for (const pid of allIds) {
    result[pid] = 0;
  }

  const totalCorrect = Object.values(params.correctContributions).reduce(
    (a, b) => a + b,
    0,
  );

  // 0 bonne réponse sur toute la manche = 0 point pour tout le monde.
  if (totalCorrect === 0) return result;

  const total = params.eliminationOrder.length + params.survivors.length;
  params.eliminationOrder.forEach((pid, idx) => {
    const rank = idx + 1;
    const share = Math.max(1, rank / total);
    result[pid] = Math.round(base * share * 0.5);
  });
  // Bonus de survie : réservé aux survivants qui ont effectivement contribué.
  for (const pid of params.survivors) {
    if ((params.correctContributions[pid] ?? 0) > 0) {
      result[pid] = base * 2;
    }
  }
  for (const [pid, contrib] of Object.entries(params.correctContributions)) {
    if (contrib > 0) {
      result[pid] = (result[pid] ?? 0) + contrib * 20;
    }
  }
  return result;
}

/**
 * Scoring Patate chaude.
 * Si le joueur a bidé N et qu'il en a trouvé >= N : il gagne base * N.
 * Sinon il gagne proportionnel à ce qu'il a trouvé, mais pénalité s'il a sur-bidé.
 */
export function hotPotatoScore(params: {
  bid: number;
  found: number;
  difficulty: Difficulty;
}): number {
  const base = DIFFICULTY_POINTS[params.difficulty];
  if (params.bid <= 0) return 0;
  if (params.found >= params.bid) {
    // réussite : plus tu bidais, plus tu ramasses
    return Math.round(base * params.bid * 0.6);
  }
  // échec : score partiel, pénalité
  const ratio = params.found / params.bid;
  return Math.round(base * ratio * 0.25);
}

/**
 * Scoring Rapidité éliminatoire.
 * Plus tu survis longtemps, plus tu marques. Le tout dernier éliminé (ou survivant)
 * rafle le gros du pot.
 */
export function speedElimScore(params: {
  rank: number; // 1 = éliminé en premier ; n = dernier survivant
  total: number;
  difficulty: Difficulty;
  correct: boolean;
}): number {
  const base = DIFFICULTY_POINTS[params.difficulty];
  if (!params.correct) return 0;
  const share = params.rank / params.total;
  return Math.round(base * share);
}

/**
 * Distance haversine en km entre deux points.
 */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Scoring mode carte : fonction affine inverse sur la distance.
 * dist = 0 → score max ; dist >= maxKm → 0.
 */
export function mapScore(params: {
  distanceKm: number;
  maxKm: number;
  difficulty: Difficulty;
}): number {
  const base = DIFFICULTY_POINTS[params.difficulty];
  if (params.distanceKm <= 0) return base * 3;
  if (params.distanceKm >= params.maxKm) return 0;
  const ratio = 1 - params.distanceKm / params.maxKm;
  return Math.round(base * 3 * ratio * ratio); // easing quadratique
}

/**
 * Scoring chronologie : basé sur le nombre d'inversions de Kendall entre
 * la réponse du joueur et l'ordre correct. Zéro inversion = score max.
 */
export function chronologyScore(params: {
  correctOrder: string[];
  playerOrder: string[];
  difficulty: Difficulty;
}): number {
  if (params.playerOrder.length !== params.correctOrder.length) {
    return 0;
  }
  const positionInCorrect = new Map<string, number>();
  params.correctOrder.forEach((id, i) => positionInCorrect.set(id, i));
  const indexes = params.playerOrder.map((id) => positionInCorrect.get(id) ?? -1);
  if (indexes.some((i) => i < 0)) return 0;
  let inversions = 0;
  for (let i = 0; i < indexes.length; i++) {
    for (let j = i + 1; j < indexes.length; j++) {
      if ((indexes[i] ?? 0) > (indexes[j] ?? 0)) inversions++;
    }
  }
  const n = indexes.length;
  const maxInversions = (n * (n - 1)) / 2;
  if (maxInversions === 0) return 0;
  const base = DIFFICULTY_POINTS[params.difficulty];
  const quality = 1 - inversions / maxInversions;
  return Math.round(base * 2 * quality * quality);
}

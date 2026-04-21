import {
  AVATAR_POOL,
  GUESS_WHO_GRID_SIZE,
  type GuessWhoQuestion,
  type Player,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
} from '@mvpc/shared';
import type {
  AcceptAnswerResult,
  GameMode,
  GameModeContext,
  GuessWhoState,
  RoundState,
} from '../types.js';

function playerOrder(players: Player[], seed: number): string[] {
  const arr = players.map((p) => p.id);
  const rng = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Génère une grille de GUESS_WHO_GRID_SIZE avatars pour un joueur :
 * son secret + (N-1) avatars aléatoires tirés sans remise du pool, puis mélange.
 */
export function buildGrid(secretSrc: string, size = GUESS_WHO_GRID_SIZE): string[] {
  const pool = AVATAR_POOL.filter((s) => s !== secretSrc);
  const decoys: string[] = [];
  const needed = Math.max(0, Math.min(size - 1, pool.length));
  const available = [...pool];
  for (let i = 0; i < needed; i++) {
    const idx = Math.floor(Math.random() * available.length);
    decoys.push(available[idx]!);
    available.splice(idx, 1);
  }
  const grid = [secretSrc, ...decoys];
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [grid[i], grid[j]] = [grid[j]!, grid[i]!];
  }
  return grid;
}

export function gwAlivePlayers(gw: GuessWhoState, players: Player[]): Player[] {
  return players.filter((p) => !gw.eliminated.has(p.id));
}

function maskKey(maskerId: string, targetId: string): string {
  return `${maskerId}|${targetId}`;
}

export function gwGetMasks(gw: GuessWhoState, maskerId: string, targetId: string): Set<string> {
  const key = maskKey(maskerId, targetId);
  let s = gw.masks.get(key);
  if (!s) {
    s = new Set();
    gw.masks.set(key, s);
  }
  return s;
}

export function gwMasksForPlayer(
  gw: GuessWhoState,
  maskerId: string,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, set] of gw.masks.entries()) {
    const [mid, tid] = key.split('|');
    if (mid !== maskerId || !tid) continue;
    out[tid] = [...set];
  }
  return out;
}

export function gwCurrentTargetId(gw: GuessWhoState): string | undefined {
  if (gw.sub !== 'play') return undefined;
  if (gw.ended) return undefined;
  return gw.turnOrder[gw.currentTargetIndex];
}

/**
 * Nombre de cycles complets joués par round (chaque cycle = un passage sur
 * tous les joueurs en vie). Augmenté à 3 pour donner de la matière au mode.
 */
export const GUESS_WHO_CYCLES_PER_ROUND = 3;

/**
 * Avance l'index courant en sautant les éliminés. Quand on atteint la fin de
 * `turnOrder`, on compte un cycle de plus ; tant que le nombre de cycles
 * joués < `GUESS_WHO_CYCLES_PER_ROUND`, on reboucle depuis le début. Sinon on
 * marque la manche finie. Retourne `true` si un nouveau target a été trouvé.
 */
export function gwAdvanceTurn(gw: GuessWhoState): boolean {
  const n = gw.turnOrder.length;
  for (let idx = gw.currentTargetIndex + 1; idx < n; idx++) {
    const candidate = gw.turnOrder[idx]!;
    if (!gw.eliminated.has(candidate)) {
      gw.currentTargetIndex = idx;
      return true;
    }
  }
  gw.cyclesPlayed += 1;
  if (gw.cyclesPlayed < GUESS_WHO_CYCLES_PER_ROUND) {
    for (let idx = 0; idx < n; idx++) {
      const candidate = gw.turnOrder[idx]!;
      if (!gw.eliminated.has(candidate)) {
        gw.currentTargetIndex = idx;
        return true;
      }
    }
  }
  gw.ended = true;
  return false;
}

export const guessWhoMode: GameMode = {
  id: 'guess-who',

  prepare(ctx: GameModeContext): RoundState {
    const q = ctx.question as GuessWhoQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'guess-who',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
    };
    const order = playerOrder(ctx.players, ctx.roundIndex + 13);
    const gw: GuessWhoState = {
      sub: 'select',
      turnOrder: order,
      currentTargetIndex: 0,
      secrets: new Map(),
      grids: new Map(),
      masks: new Map(),
      eliminated: new Set(),
      revealed: new Map(),
      guesses: [],
      pendingGuesses: [],
      guessBans: new Map(),
      turnsPlayed: 0,
      cyclesPlayed: 0,
      ended: false,
    };
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'guess-who',
      collect: { kind: 'guess-who', gw },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(): AcceptAnswerResult {
    return {
      ok: false,
      code: 'PHASE_MISMATCH',
      message: 'guess-who utilise ses propres events',
    };
  },

  isCollectComplete(state) {
    if (state.collect.kind !== 'guess-who') return true;
    const gw = state.collect.gw;
    if (gw.sub !== 'play') return false;
    // Une manche s'achève quand :
    // - il ne reste plus qu'un joueur en vie (elim en cascade), OU
    // - on a bouclé un cycle complet sur l'ordre de passage (`ended`).
    if (gw.ended) return true;
    const aliveCount = gw.turnOrder.filter((id) => !gw.eliminated.has(id)).length;
    if (aliveCount <= 1) {
      gw.ended = true;
      return true;
    }
    return false;
  },

  buildReveal(state, players): RoundReveal {
    const answers: RoundReveal['answers'] = [];
    if (state.collect.kind === 'guess-who') {
      const gw = state.collect.gw;
      for (const p of players) {
        const secret = gw.secrets.get(p.id);
        answers.push({
          playerId: p.id,
          text: secret ?? '',
        });
      }
    }
    return {
      roundIndex: state.roundIndex,
      question: state.question,
      answers,
      autoValidations: {},
      eliminationOrder:
        state.collect.kind === 'guess-who'
          ? [...state.collect.gw.eliminated]
          : undefined,
    };
  },

  computeScores(state, players): RoundScoring {
    // +1 par guess correct posé par un joueur durant le round. Plusieurs
    // joueurs peuvent marquer, et un même joueur peut marquer plusieurs fois
    // (une par cible au plus).
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    const correctByPlayer = new Map<string, number>();
    let officialAnswer = 'Personne n’a trouvé';
    if (state.collect.kind === 'guess-who') {
      const gw = state.collect.gw;
      for (const g of gw.guesses) {
        if (!g.correct) continue;
        correctByPlayer.set(g.playerId, (correctByPlayer.get(g.playerId) ?? 0) + 1);
      }
      const winners = [...correctByPlayer.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => {
          const p = players.find((pl) => pl.id === id);
          return p ? `${p.nickname} (+${n})` : null;
        })
        .filter((s): s is string => s !== null);
      if (winners.length > 0) {
        officialAnswer = `Bien deviné : ${winners.join(', ')}`;
      }
    }
    for (const p of players) {
      const delta = correctByPlayer.get(p.id) ?? 0;
      deltas[p.id] = delta;
      totals[p.id] = p.score + delta;
    }
    return {
      roundIndex: state.roundIndex,
      deltas,
      totals,
      officialAnswer,
    };
  },
};

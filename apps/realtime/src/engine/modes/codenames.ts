import {
  type CodenamesQuestion,
  type Player,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
} from '@mvpc/shared';
import { CODENAMES_WORDS } from '@mvpc/content';
import type {
  AcceptAnswerResult,
  CodenamesColor,
  CodenamesState,
  CodenamesTile,
  GameMode,
  GameModeContext,
  RoundState,
} from '../types.js';

/** Durées par défaut des sous-phases. */
export const CODENAMES_CLUE_SECONDS = 90;
export const CODENAMES_GUESS_SECONDS = 60;

/** Nombre de tuiles par équipe. L'équipe qui commence a 9 mots, l'autre 8. */
const TILES_STARTER = 9;
const TILES_SECOND = 8;
const TILES_NEUTRAL = 7;
const TILES_ASSASSIN = 1;
const GRID_SIZE = TILES_STARTER + TILES_SECOND + TILES_NEUTRAL + TILES_ASSASSIN; // 25

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Tire un seul élément dans le tableau (non-mutant). */
function pickOne<T>(arr: T[], rng: () => number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

/** Joueur actif = non-spectateur (pour filtrer depuis ctx.players). */
function isActive(p: Player): boolean {
  return p.cnTeam === 'red' || p.cnTeam === 'blue';
}

/** Retourne la clé complète (25 couleurs) — n'est à communiquer qu'aux spymasters. */
export function cnKeyColors(cn: CodenamesState): CodenamesColor[] {
  return cn.grid.map((t) => t.color);
}

/** L'équipe adverse. */
function otherTeam(team: 'red' | 'blue'): 'red' | 'blue' {
  return team === 'red' ? 'blue' : 'red';
}

function remaining(cn: CodenamesState, team: 'red' | 'blue'): number {
  return cn.grid.filter((t) => t.color === team && !t.revealed).length;
}

/** Vérifie si le spymaster fourni joue pour l'équipe active. */
function isActiveSpymaster(cn: CodenamesState, playerId: string): boolean {
  return cn.spymasters[cn.currentTeam] === playerId;
}

/** Renvoie la liste des devineurs (non-spymasters) de l'équipe active. */
export function cnActiveGuessers(cn: CodenamesState): string[] {
  return cn.guessers[cn.currentTeam] ?? [];
}

/** Vérifie si un joueur est devineur de l'équipe active. */
function isActiveGuesser(cn: CodenamesState, playerId: string): boolean {
  return cnActiveGuessers(cn).includes(playerId);
}

/** Échoue la partie pour l'équipe adverse (assassin). */
function endWithAssassin(cn: CodenamesState, clickingTeam: 'red' | 'blue', now: number): void {
  cn.sub = 'done';
  cn.winner = otherTeam(clickingTeam);
  cn.endReason = 'assassin';
  cn.endsAt = now;
  cn.clue = undefined;
  cn.guessesLeft = 0;
}

/** Termine la partie (tous les mots trouvés par `team`). */
function endWithAllFound(cn: CodenamesState, team: 'red' | 'blue', now: number): void {
  cn.sub = 'done';
  cn.winner = team;
  cn.endReason = 'allFound';
  cn.endsAt = now;
  cn.clue = undefined;
  cn.guessesLeft = 0;
}

/** Passe le tour : l'équipe adverse devient active, retour en phase clue. */
function swapTurn(cn: CodenamesState, now: number): void {
  cn.currentTeam = otherTeam(cn.currentTeam);
  cn.sub = 'clue';
  cn.clue = undefined;
  cn.guessesLeft = 0;
  cn.endsAt = now + CODENAMES_CLUE_SECONDS * 1000;
}

/** Tire les mots, les couleurs, shuffle puis retourne la grille. */
function buildGrid(starter: 'red' | 'blue', rng: () => number): CodenamesTile[] {
  if (CODENAMES_WORDS.length < GRID_SIZE) {
    throw new Error('Pas assez de mots dans la banque Codenames');
  }
  const words = shuffled(CODENAMES_WORDS, rng).slice(0, GRID_SIZE);
  const colors: CodenamesColor[] = [];
  for (let i = 0; i < TILES_STARTER; i++) colors.push(starter);
  for (let i = 0; i < TILES_SECOND; i++) colors.push(otherTeam(starter));
  for (let i = 0; i < TILES_NEUTRAL; i++) colors.push('neutral');
  for (let i = 0; i < TILES_ASSASSIN; i++) colors.push('assassin');
  const shuffledColors = shuffled(colors, rng);
  return words.map((word, i) => ({
    word,
    color: shuffledColors[i]!,
    revealed: false,
  }));
}

/** Désigne le spymaster de l'équipe : volontaire au hasard, sinon 1er joueur. */
function pickSpymaster(team: 'red' | 'blue', players: Player[], rng: () => number): string {
  const inTeam = players.filter((p) => p.cnTeam === team);
  if (inTeam.length === 0) return '';
  const volunteers = inTeam.filter((p) => p.cnWantsSpymaster === true);
  const pool = volunteers.length > 0 ? volunteers : inTeam;
  const picked = pickOne(pool, rng);
  return picked?.id ?? inTeam[0]!.id;
}

/* --------------------------------------------------------------------- */
/* Actions joueurs                                                       */
/* --------------------------------------------------------------------- */

/** Le spymaster courant soumet un indice : passe en phase guess. */
export function cnSubmitClue(
  cn: CodenamesState,
  playerId: string,
  word: string,
  count: number,
  now: number,
): { accepted: boolean; code?: string } {
  if (cn.sub !== 'clue') return { accepted: false, code: 'PHASE_MISMATCH' };
  if (!isActiveSpymaster(cn, playerId)) return { accepted: false, code: 'NOT_YOUR_TURN' };
  // Refuse un indice égal à un mot encore visible sur le plateau.
  const lower = word.toLocaleLowerCase('fr');
  const collidesWithBoard = cn.grid.some(
    (t) => !t.revealed && t.word.toLocaleLowerCase('fr') === lower,
  );
  if (collidesWithBoard) return { accepted: false, code: 'INVALID_PAYLOAD' };
  const trimmed = word.trim();
  if (!trimmed) return { accepted: false, code: 'INVALID_PAYLOAD' };
  cn.clue = { word: trimmed, count, byTeam: cn.currentTeam };
  cn.clueHistory.push({ ...cn.clue });
  // count + 1 tentatives ; `count === 0` signifie "infini" → on autorise jusqu'à la fin
  // des mots restants de l'équipe.
  if (count === 0) {
    cn.guessesLeft = Math.max(1, remaining(cn, cn.currentTeam));
  } else {
    cn.guessesLeft = count + 1;
  }
  cn.sub = 'guess';
  cn.endsAt = now + CODENAMES_GUESS_SECONDS * 1000;
  return { accepted: true };
}

/** Un devineur de l'équipe active clique une tuile. */
export function cnGuessTile(
  cn: CodenamesState,
  playerId: string,
  index: number,
  now: number,
): { accepted: boolean; code?: string } {
  if (cn.sub !== 'guess') return { accepted: false, code: 'PHASE_MISMATCH' };
  if (!isActiveGuesser(cn, playerId)) return { accepted: false, code: 'NOT_YOUR_TURN' };
  const tile = cn.grid[index];
  if (!tile) return { accepted: false, code: 'INVALID_PAYLOAD' };
  if (tile.revealed) return { accepted: false, code: 'INVALID_PAYLOAD' };
  tile.revealed = true;

  if (tile.color === 'assassin') {
    endWithAssassin(cn, cn.currentTeam, now);
    return { accepted: true };
  }

  // Vérifie une victoire par mots trouvés (rouge ou bleu vide).
  if (remaining(cn, 'red') === 0) {
    endWithAllFound(cn, 'red', now);
    return { accepted: true };
  }
  if (remaining(cn, 'blue') === 0) {
    endWithAllFound(cn, 'blue', now);
    return { accepted: true };
  }

  if (tile.color === cn.currentTeam) {
    // Bonne réponse : le tour continue si guessesLeft > 1.
    cn.guessesLeft = Math.max(0, cn.guessesLeft - 1);
    if (cn.guessesLeft <= 0) {
      swapTurn(cn, now);
    }
    return { accepted: true };
  }

  // Neutre ou équipe adverse : fin de tour immédiate.
  swapTurn(cn, now);
  return { accepted: true };
}

/** Un devineur de l'équipe active stoppe volontairement le tour. */
export function cnEndTurn(
  cn: CodenamesState,
  playerId: string,
  now: number,
): { accepted: boolean; code?: string } {
  if (cn.sub !== 'guess') return { accepted: false, code: 'PHASE_MISMATCH' };
  if (!isActiveGuesser(cn, playerId)) return { accepted: false, code: 'NOT_YOUR_TURN' };
  swapTurn(cn, now);
  return { accepted: true };
}

/**
 * Timeout : en clue, l'équipe active passe son tour (forfait).
 * En guess, on passe le tour sans pénalité supplémentaire.
 */
export function cnTick(
  cn: CodenamesState,
  now: number,
): { advanced: boolean; completed: boolean } {
  if (cn.sub === 'done') return { advanced: false, completed: true };
  if (now < cn.endsAt) return { advanced: false, completed: false };
  if (cn.sub === 'clue') {
    // Forfait indice : on enregistre une clue "—/0" et on saute le tour.
    cn.clueHistory.push({ word: '—', count: 0, byTeam: cn.currentTeam });
    swapTurn(cn, now);
    return { advanced: true, completed: false };
  }
  // sub === 'guess'
  swapTurn(cn, now);
  return { advanced: true, completed: false };
}

/* --------------------------------------------------------------------- */
/* GameMode interface                                                    */
/* --------------------------------------------------------------------- */

export const codenamesMode: GameMode = {
  id: 'codenames',

  prepare(ctx: GameModeContext): RoundState {
    const q = ctx.question as CodenamesQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'codenames',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
    };
    // N'utilise que les joueurs non-spectateurs.
    const active = ctx.players.filter(isActive);
    const seed = ctx.roundIndex + 999 + active.length * 13;
    const rng = mulberry32(seed);
    // Tirage de l'équipe qui commence.
    const starter: 'red' | 'blue' = rng() < 0.5 ? 'red' : 'blue';
    const grid = buildGrid(starter, rng);
    const redSpy = pickSpymaster('red', active, rng);
    const blueSpy = pickSpymaster('blue', active, rng);
    const guessers = {
      red: active.filter((p) => p.cnTeam === 'red' && p.id !== redSpy).map((p) => p.id),
      blue: active.filter((p) => p.cnTeam === 'blue' && p.id !== blueSpy).map((p) => p.id),
    };
    const cn: CodenamesState = {
      sub: 'clue',
      grid,
      currentTeam: starter,
      spymasters: { red: redSpy, blue: blueSpy },
      guessers,
      clue: undefined,
      guessesLeft: 0,
      endsAt: ctx.now() + CODENAMES_CLUE_SECONDS * 1000,
      clueHistory: [],
    };
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'codenames',
      collect: { kind: 'codenames', cn },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(): AcceptAnswerResult {
    return {
      ok: false,
      code: 'PHASE_MISMATCH',
      message: 'codenames utilise ses propres events',
    };
  },

  isCollectComplete(state) {
    if (state.collect.kind !== 'codenames') return true;
    return state.collect.cn.sub === 'done';
  },

  buildReveal(state): RoundReveal {
    // On n'utilise pas `answers` classiques ; la vue Codenames lit depuis `snapshot.round`.
    return {
      roundIndex: state.roundIndex,
      question: state.question,
      answers: [],
      autoValidations: {},
    };
  },

  computeScores(state, players): RoundScoring {
    // Pas de points : +1 victoire à tous les membres de l'équipe gagnante,
    // 0 pour tout le monde sinon (spectateurs, équipe perdante).
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    let officialAnswer = '';
    if (state.collect.kind === 'codenames') {
      const cn = state.collect.cn;
      const winner = cn.winner;
      officialAnswer =
        winner === 'red'
          ? 'Équipe Rouge gagnante'
          : winner === 'blue'
            ? 'Équipe Bleu gagnante'
            : 'Match nul';
      for (const p of players) {
        const delta = p.cnTeam === winner ? 1 : 0;
        deltas[p.id] = delta;
        totals[p.id] = p.score + delta;
      }
    } else {
      for (const p of players) {
        deltas[p.id] = 0;
        totals[p.id] = p.score;
      }
    }
    return {
      roundIndex: state.roundIndex,
      deltas,
      totals,
      officialAnswer,
    };
  },
};

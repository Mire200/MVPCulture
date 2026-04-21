import {
  type ImposterQuestion,
  type Player,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
} from '@mvpc/shared';
import type {
  AcceptAnswerResult,
  GameMode,
  GameModeContext,
  ImposterState,
  RoundState,
} from '../types.js';
import { equalsLoose, normalize } from '../../util/text.js';

/** Durées par défaut, en secondes. */
export const IMPOSTER_CLUE_TURN_SECONDS = 25;
export const IMPOSTER_VOTE_SECONDS = 45;
export const IMPOSTER_GUESS_SECONDS = 20;

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

/**
 * Retourne le mot à afficher à un joueur. On n'expose PAS son rôle : le joueur
 * ne doit jamais savoir qu'il est l'imposteur (il doit bluffer à l'aveugle et
 * ne le découvre qu'au vote final s'il est démasqué).
 */
export function imWordFor(im: ImposterState, playerId: string): { word: string } | undefined {
  const role = im.assignments.get(playerId);
  if (!role) return undefined;
  return {
    word: role === 'imposter' ? im.imposterWord : im.civilianWord,
  };
}

/** Joueur qui doit parler maintenant (undefined hors phases d'indice). */
export function imCurrentClueSpeakerId(im: ImposterState): string | undefined {
  if (im.sub !== 'clue-1' && im.sub !== 'clue-2') return undefined;
  return im.playerOrder[im.clueTurnIndex];
}

/** Passe à la sous-phase suivante et met à jour le deadline. */
function advancePhase(im: ImposterState, now: number): void {
  if (im.sub === 'clue-1') {
    im.sub = 'clue-2';
    im.clueTurnIndex = 0;
    im.endsAt = now + IMPOSTER_CLUE_TURN_SECONDS * 1000;
    return;
  }
  if (im.sub === 'clue-2') {
    im.sub = 'vote';
    im.endsAt = now + IMPOSTER_VOTE_SECONDS * 1000;
    return;
  }
  if (im.sub === 'vote') {
    const tally = computeTally(im);
    const top = topTargets(tally);
    // Démasqué si l'imposteur est SEUL en tête du vote.
    const demasque = top.length === 1 && top[0] === im.imposterId;
    im.demasque = demasque;
    if (demasque) {
      im.sub = 'guess';
      im.endsAt = now + IMPOSTER_GUESS_SECONDS * 1000;
      return;
    }
    im.sub = 'done';
    im.endsAt = now;
    return;
  }
  if (im.sub === 'guess') {
    im.sub = 'done';
    im.endsAt = now;
    return;
  }
}

function computeTally(im: ImposterState): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const [, targetId] of im.votes) {
    tally[targetId] = (tally[targetId] ?? 0) + 1;
  }
  return tally;
}

function topTargets(tally: Record<string, number>): string[] {
  let best = -1;
  for (const v of Object.values(tally)) if (v > best) best = v;
  if (best <= 0) return [];
  return Object.entries(tally)
    .filter(([, v]) => v === best)
    .map(([k]) => k);
}

/**
 * Soumission de l'indice du joueur dont c'est le tour. Avance au joueur
 * suivant, ou à la sous-phase suivante si le tour de table est bouclé.
 */
export function imSubmitClue(
  im: ImposterState,
  playerId: string,
  clue: string,
  _activePlayers: Player[],
  now: number,
): { accepted: boolean; advanced: boolean; code?: string } {
  if (im.sub !== 'clue-1' && im.sub !== 'clue-2') {
    return { accepted: false, advanced: false, code: 'PHASE_MISMATCH' };
  }
  if (!im.assignments.has(playerId)) {
    return { accepted: false, advanced: false, code: 'NOT_IN_ROOM' };
  }
  const currentSpeaker = imCurrentClueSpeakerId(im);
  if (currentSpeaker !== playerId) {
    return { accepted: false, advanced: false, code: 'NOT_YOUR_TURN' };
  }
  const roundIdx = im.sub === 'clue-1' ? 0 : 1;
  const map = im.clues[roundIdx];
  if (!map) return { accepted: false, advanced: false, code: 'INTERNAL' };
  if (map.has(playerId)) {
    return { accepted: false, advanced: false, code: 'ALREADY_ANSWERED' };
  }
  // Refuse un indice égal strictement à l'un des deux mots (garde-fou simple).
  const cn = normalize(clue);
  if (cn === normalize(im.civilianWord) || cn === normalize(im.imposterWord)) {
    return { accepted: false, advanced: false, code: 'INVALID_PAYLOAD' };
  }
  map.set(playerId, clue.trim());
  // Avance au joueur suivant ou à la sous-phase suivante.
  im.clueTurnIndex++;
  if (im.clueTurnIndex >= im.playerOrder.length) {
    advancePhase(im, now);
    return { accepted: true, advanced: true };
  }
  im.endsAt = now + IMPOSTER_CLUE_TURN_SECONDS * 1000;
  return { accepted: true, advanced: true };
}

export function imCastVote(
  im: ImposterState,
  voterId: string,
  targetId: string,
  activePlayers: Player[],
  now: number,
): { accepted: boolean; advanced: boolean; code?: string } {
  if (im.sub !== 'vote') return { accepted: false, advanced: false, code: 'PHASE_MISMATCH' };
  if (!im.assignments.has(voterId)) return { accepted: false, advanced: false, code: 'NOT_IN_ROOM' };
  if (!im.assignments.has(targetId)) return { accepted: false, advanced: false, code: 'INVALID_PAYLOAD' };
  if (voterId === targetId) return { accepted: false, advanced: false, code: 'INVALID_PAYLOAD' };
  if (im.votes.has(voterId)) return { accepted: false, advanced: false, code: 'ALREADY_ANSWERED' };
  im.votes.set(voterId, targetId);
  const allVoted = activePlayers.every((p) => im.votes.has(p.id));
  if (allVoted) {
    advancePhase(im, now);
    return { accepted: true, advanced: true };
  }
  return { accepted: true, advanced: false };
}

export function imSubmitGuess(
  im: ImposterState,
  playerId: string,
  guess: string,
  now: number,
): { accepted: boolean; advanced: boolean; code?: string } {
  if (im.sub !== 'guess') return { accepted: false, advanced: false, code: 'PHASE_MISMATCH' };
  if (playerId !== im.imposterId) return { accepted: false, advanced: false, code: 'NOT_YOUR_TURN' };
  const candidates = [im.civilianWord, ...im.aliases];
  const correct = candidates.some((c) => equalsLoose(c, guess));
  im.imposterGuess = guess.trim();
  im.guessCorrect = correct;
  advancePhase(im, now);
  return { accepted: true, advanced: true };
}

/**
 * Timeout : à appeler périodiquement.
 * - En clue-1/clue-2 : le joueur courant rate son tour (indice = "—") et on
 *   passe au suivant. Le tour de table termine quand tous sont passés.
 * - En vote/guess : on passe à l'étape suivante.
 */
export function imTick(
  im: ImposterState,
  _activePlayers: Player[],
  now: number,
): { advanced: boolean; completed: boolean } {
  if (im.sub === 'done') return { advanced: false, completed: true };
  if (now < im.endsAt) return { advanced: false, completed: false };

  if (im.sub === 'clue-1' || im.sub === 'clue-2') {
    const roundIdx = im.sub === 'clue-1' ? 0 : 1;
    const map = im.clues[roundIdx];
    const currentId = imCurrentClueSpeakerId(im);
    if (currentId && map && !map.has(currentId)) {
      map.set(currentId, '—');
    }
    im.clueTurnIndex++;
    if (im.clueTurnIndex >= im.playerOrder.length) {
      advancePhase(im, now);
    } else {
      im.endsAt = now + IMPOSTER_CLUE_TURN_SECONDS * 1000;
    }
    return { advanced: true, completed: (im.sub as ImposterState['sub']) === 'done' };
  }

  advancePhase(im, now);
  return { advanced: true, completed: (im.sub as ImposterState['sub']) === 'done' };
}

export const imposterMode: GameMode = {
  id: 'imposter',

  prepare(ctx: GameModeContext): RoundState {
    const q = ctx.question as ImposterQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'imposter',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
    };
    const players = ctx.players;
    const seed = ctx.roundIndex + 101 + players.length * 7;
    const rng = mulberry32(seed);
    const order = shuffled(
      players.map((p) => p.id),
      rng,
    );
    // Tirage de l'imposteur (robuste même à 0-1 joueur ; le startGame valide un min côté room).
    const imposterId = order.length > 0 ? order[Math.floor(rng() * order.length)]! : '';
    const assignments = new Map<string, 'civil' | 'imposter'>();
    for (const id of order) {
      assignments.set(id, id === imposterId ? 'imposter' : 'civil');
    }
    const im: ImposterState = {
      sub: 'clue-1',
      civilianWord: q.civilianWord,
      imposterWord: q.imposterWord,
      aliases: q.aliases ?? [],
      imposterId,
      playerOrder: order,
      clueTurnIndex: 0,
      assignments,
      clues: [new Map(), new Map()],
      votes: new Map(),
      endsAt: ctx.now() + IMPOSTER_CLUE_TURN_SECONDS * 1000,
    };
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'imposter',
      collect: { kind: 'imposter', im },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(): AcceptAnswerResult {
    return {
      ok: false,
      code: 'PHASE_MISMATCH',
      message: 'imposter utilise ses propres events',
    };
  },

  isCollectComplete(state) {
    if (state.collect.kind !== 'imposter') return true;
    return state.collect.im.sub === 'done';
  },

  buildReveal(state, players): RoundReveal {
    const answers: RoundReveal['answers'] = [];
    if (state.collect.kind === 'imposter') {
      const im = state.collect.im;
      // On ré-utilise `text` pour l'indice du tour 1 et `listItems` (hack simple) pour les 2 indices.
      for (const p of players) {
        const c1 = im.clues[0]?.get(p.id) ?? '';
        const c2 = im.clues[1]?.get(p.id) ?? '';
        answers.push({
          playerId: p.id,
          text: c1,
          listItems: [c1, c2].filter((s): s is string => !!s),
        });
      }
    }
    return {
      roundIndex: state.roundIndex,
      question: state.question,
      answers,
      autoValidations: {},
    };
  },

  computeScores(state, players): RoundScoring {
    // Pas de points : +1 victoire pour le camp gagnant, 0 pour les autres.
    // - L'imposteur gagne s'il n'est pas démasqué, ou s'il est démasqué mais
    //   devine correctement le mot civil.
    // - Sinon, les civils gagnent en bloc (tous ceux qui ne sont pas l'imposteur).
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    let officialAnswer = '';
    if (state.collect.kind === 'imposter') {
      const im = state.collect.im;
      officialAnswer = im.civilianWord;
      const imposterWins = !im.demasque || im.guessCorrect === true;
      for (const p of players) {
        const delta =
          (imposterWins && p.id === im.imposterId) ||
          (!imposterWins && p.id !== im.imposterId)
            ? 1
            : 0;
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

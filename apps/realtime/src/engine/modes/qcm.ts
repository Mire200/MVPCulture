import {
  type HostValidation,
  type PublicQuestion,
  type QcmQuestion,
  type RoundReveal,
  type RoundScoring,
  classicScore,
} from '@mvpc/shared';
import type { AcceptAnswerResult, GameMode, GameModeContext, RoundState } from '../types.js';
import { equalsLoose } from '../../util/text.js';

/**
 * Petit PRNG déterministe (mulberry32) pour que l'ordre des choix ne change
 * pas entre deux snapshots de la même manche.
 */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Construit les choix publics (bonne réponse + distracteurs), mélangés. */
function buildChoices(q: QcmQuestion, roundIndex: number): string[] {
  const rng = mulberry32(hashStr(q.id) ^ (roundIndex + 1));
  const all = [q.answer, ...q.distractors];
  // Dédoublonnage défensif en cas de doublon dans le seed.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const c of all) {
    const key = c.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return shuffled(unique, rng);
}

export const qcmMode: GameMode = {
  id: 'qcm',

  prepare(ctx: GameModeContext, defaultSeconds: number): RoundState {
    const q = ctx.question as QcmQuestion;
    const choices = buildChoices(q, ctx.roundIndex);
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'qcm',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
      choices,
    };
    const endsAt = ctx.now() + defaultSeconds * 1000;
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'qcm',
      collect: { kind: 'parallel', answers: new Map(), endsAt },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(state, playerId, payload): AcceptAnswerResult {
    if (state.collect.kind !== 'parallel') {
      return { ok: false, code: 'PHASE_MISMATCH', message: 'Bad phase' };
    }
    if (state.collect.answers.has(playerId)) {
      return { ok: false, code: 'ALREADY_ANSWERED', message: 'Déjà répondu' };
    }
    const q = state.question as QcmQuestion;
    const raw = payload.text?.trim() ?? '';
    if (!raw) {
      return { ok: false, code: 'EMPTY', message: 'Choix vide' };
    }
    // Exige que la valeur envoyée corresponde à l'un des choix publiés, pour
    // empêcher les clients de triturer un texte libre.
    const choices = state.publicQuestion.choices ?? [];
    const isKnownChoice = choices.some((c) => equalsLoose(c, raw));
    if (!isKnownChoice) {
      return { ok: false, code: 'UNKNOWN_CHOICE', message: 'Choix invalide' };
    }
    state.collect.answers.set(playerId, {
      playerId,
      raw: { text: raw },
      submittedAt: Date.now(),
    });
    const correct = equalsLoose(q.answer, raw);
    state.autoValidations[playerId] = correct;
    return { ok: true, roundState: state, events: [{ type: 'player_answered', playerId }] };
  },

  isCollectComplete(state, activePlayers) {
    if (state.collect.kind !== 'parallel') return true;
    if (Date.now() >= state.collect.endsAt) return true;
    return state.collect.answers.size >= activePlayers.length;
  },

  buildReveal(state, players): RoundReveal {
    const answers: RoundReveal['answers'] = [];
    if (state.collect.kind === 'parallel') {
      for (const p of players) {
        const a = state.collect.answers.get(p.id);
        answers.push({ playerId: p.id, text: a?.raw.text ?? '' });
      }
    }
    return {
      roundIndex: state.roundIndex,
      question: state.question,
      answers,
      autoValidations: { ...state.autoValidations },
    };
  },

  computeScores(state, players, hostValidations?: HostValidation[]): RoundScoring {
    const q = state.question as QcmQuestion;
    const overrides = new Map<string, boolean>();
    for (const v of hostValidations ?? []) overrides.set(v.playerId, v.correct);
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    for (const p of players) {
      const correct = overrides.get(p.id) ?? state.autoValidations[p.id] ?? false;
      const delta = classicScore(q.difficulty, correct);
      deltas[p.id] = delta;
      totals[p.id] = p.score + delta;
    }
    return {
      roundIndex: state.roundIndex,
      deltas,
      totals,
      officialAnswer: q.answer,
    };
  },
};

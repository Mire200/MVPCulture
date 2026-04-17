import {
  type AnswerPayload,
  type ClassicQuestion,
  type HostValidation,
  type Player,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
  classicScore,
} from '@mvpc/shared';
import type { AcceptAnswerResult, GameMode, GameModeContext, RoundState } from '../types.js';
import { equalsLoose, normalize } from '../../util/text.js';

export const classicMode: GameMode = {
  id: 'classic',

  prepare(ctx: GameModeContext, defaultSeconds: number): RoundState {
    const q = ctx.question as ClassicQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'classic',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
    };
    const endsAt = ctx.now() + defaultSeconds * 1000;
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'classic',
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
    const text = payload.text?.trim() ?? '';
    state.collect.answers.set(playerId, {
      playerId,
      raw: { text },
      submittedAt: Date.now(),
    });
    // Pré-validation automatique basée sur la réponse canonique + aliases.
    const q = state.question as ClassicQuestion;
    const candidates = [q.answer, ...q.aliases];
    const correct = candidates.some((c) => equalsLoose(c, text));
    state.autoValidations[playerId] = correct;
    return { ok: true, roundState: state, events: [{ type: 'player_answered', playerId }] };
  },

  isCollectComplete(state, activePlayers) {
    if (state.collect.kind !== 'parallel') return true;
    if (Date.now() >= state.collect.endsAt) return true;
    const answered = state.collect.answers.size;
    return answered >= activePlayers.length;
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
    const q = state.question as ClassicQuestion;
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

export function classicIsCorrect(q: ClassicQuestion, raw: string): boolean {
  const normalized = normalize(raw);
  const candidates = [q.answer, ...q.aliases].map(normalize);
  return candidates.includes(normalized);
}

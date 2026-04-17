import {
  type EstimationQuestion,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
  estimationScores,
} from '@mvpc/shared';
import type { AcceptAnswerResult, GameMode, GameModeContext, RoundState } from '../types.js';

export const estimationMode: GameMode = {
  id: 'estimation',

  prepare(ctx: GameModeContext, defaultSeconds: number): RoundState {
    const q = ctx.question as EstimationQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'estimation',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
      unit: q.unit,
    };
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'estimation',
      collect: { kind: 'parallel', answers: new Map(), endsAt: ctx.now() + defaultSeconds * 1000 },
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
    if (typeof payload.numeric !== 'number' || !Number.isFinite(payload.numeric)) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Valeur numérique requise' };
    }
    state.collect.answers.set(playerId, {
      playerId,
      raw: { numeric: payload.numeric },
      submittedAt: Date.now(),
    });
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
        answers.push({ playerId: p.id, numeric: a?.raw.numeric ?? undefined });
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
    const q = state.question as EstimationQuestion;
    const entries: Array<{ playerId: string; value: number }> = [];
    if (state.collect.kind === 'parallel') {
      for (const p of players) {
        const a = state.collect.answers.get(p.id);
        if (a && typeof a.raw.numeric === 'number') {
          entries.push({ playerId: p.id, value: a.raw.numeric });
        }
      }
    }
    const scoreMap = estimationScores(entries, q.numericAnswer, q.difficulty);
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    for (const p of players) {
      const delta = scoreMap[p.id] ?? 0;
      deltas[p.id] = delta;
      totals[p.id] = p.score + delta;
    }
    return {
      roundIndex: state.roundIndex,
      deltas,
      totals,
      officialAnswer: `${q.numericAnswer}${q.unit ? ' ' + q.unit : ''}`,
    };
  },
};

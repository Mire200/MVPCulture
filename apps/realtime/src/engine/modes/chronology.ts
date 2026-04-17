import {
  type AnswerPayload,
  type ChronologyQuestion,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
  chronologyScore,
} from '@mvpc/shared';
import type { AcceptAnswerResult, GameMode, GameModeContext, RoundState } from '../types.js';

export const chronologyMode: GameMode = {
  id: 'chronology',

  prepare(ctx: GameModeContext, defaultSeconds: number): RoundState {
    const q = ctx.question as ChronologyQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'chronology',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
      events: q.events.map((e) => ({ id: e.id, label: e.label })),
    };
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'chronology',
      collect: { kind: 'parallel', answers: new Map(), endsAt: ctx.now() + defaultSeconds * 1000 },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(state, playerId, payload: AnswerPayload): AcceptAnswerResult {
    if (state.collect.kind !== 'parallel') {
      return { ok: false, code: 'PHASE_MISMATCH', message: 'Bad phase' };
    }
    if (state.collect.answers.has(playerId)) {
      return { ok: false, code: 'ALREADY_ANSWERED', message: 'Déjà répondu' };
    }
    if (!Array.isArray(payload.order) || payload.order.length === 0) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Ordre requis' };
    }
    const q = state.question as ChronologyQuestion;
    const validIds = new Set(q.events.map((e) => e.id));
    const order = payload.order.filter((id) => validIds.has(id));
    if (order.length !== q.events.length) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Ordre incomplet' };
    }
    state.collect.answers.set(playerId, {
      playerId,
      raw: { order },
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
        answers.push({
          playerId: p.id,
          order: a?.raw.order ?? undefined,
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
    const q = state.question as ChronologyQuestion;
    const correctOrder = [...q.events].sort((a, b) => a.year - b.year).map((e) => e.id);
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    if (state.collect.kind === 'parallel') {
      for (const p of players) {
        const a = state.collect.answers.get(p.id);
        const playerOrder = a?.raw.order ?? [];
        deltas[p.id] = chronologyScore({
          correctOrder,
          playerOrder,
          difficulty: q.difficulty,
        });
        totals[p.id] = p.score + deltas[p.id]!;
      }
    }
    const officialAnswer = correctOrder
      .map((id) => {
        const e = q.events.find((x) => x.id === id);
        return e ? `${e.year} — ${e.label}` : id;
      })
      .join(' → ');
    return {
      roundIndex: state.roundIndex,
      deltas,
      totals,
      officialAnswer,
    };
  },
};

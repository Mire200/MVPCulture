import {
  type AnswerPayload,
  type MapQuestion,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
  haversineKm,
  mapScore,
} from '@mvpc/shared';
import type { AcceptAnswerResult, GameMode, GameModeContext, RoundState } from '../types.js';

export const mapMode: GameMode = {
  id: 'map',

  prepare(ctx: GameModeContext, defaultSeconds: number): RoundState {
    const q = ctx.question as MapQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'map',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
    };
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'map',
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
    if (typeof payload.lat !== 'number' || typeof payload.lng !== 'number') {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Coordonnées requises' };
    }
    state.collect.answers.set(playerId, {
      playerId,
      raw: { lat: payload.lat, lng: payload.lng },
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
    const q = state.question as MapQuestion;
    const answers: RoundReveal['answers'] = [];
    if (state.collect.kind === 'parallel') {
      for (const p of players) {
        const a = state.collect.answers.get(p.id);
        if (a && typeof a.raw.lat === 'number' && typeof a.raw.lng === 'number') {
          const distanceKm = haversineKm(a.raw.lat, a.raw.lng, q.targetLat, q.targetLng);
          answers.push({
            playerId: p.id,
            lat: a.raw.lat,
            lng: a.raw.lng,
            distanceKm: Math.round(distanceKm * 10) / 10,
          });
        } else {
          answers.push({ playerId: p.id });
        }
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
    const q = state.question as MapQuestion;
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    if (state.collect.kind === 'parallel') {
      for (const p of players) {
        const a = state.collect.answers.get(p.id);
        if (a && typeof a.raw.lat === 'number' && typeof a.raw.lng === 'number') {
          const d = haversineKm(a.raw.lat, a.raw.lng, q.targetLat, q.targetLng);
          deltas[p.id] = mapScore({ distanceKm: d, maxKm: q.maxKm, difficulty: q.difficulty });
        } else {
          deltas[p.id] = 0;
        }
        totals[p.id] = p.score + (deltas[p.id] ?? 0);
      }
    }
    return {
      roundIndex: state.roundIndex,
      deltas,
      totals,
      officialAnswer: q.targetLabel,
    };
  },
};

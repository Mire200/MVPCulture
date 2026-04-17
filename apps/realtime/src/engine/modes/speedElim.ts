import {
  type AnswerPayload,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
  type SpeedElimQuestion,
  speedElimScore,
} from '@mvpc/shared';
import type { AcceptAnswerResult, GameMode, GameModeContext, RoundState } from '../types.js';
import { equalsLoose } from '../../util/text.js';

export const speedElimMode: GameMode = {
  id: 'speed-elim',

  prepare(ctx: GameModeContext, defaultSeconds: number): RoundState {
    const q = ctx.question as SpeedElimQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'speed-elim',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
      timerSeconds: q.timerSeconds,
    };
    const duration = Math.min(defaultSeconds, q.timerSeconds);
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'speed-elim',
      collect: { kind: 'parallel', answers: new Map(), endsAt: ctx.now() + duration * 1000 },
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
    const text = payload.text?.trim() ?? '';
    if (!text) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Texte requis' };
    }
    const q = state.question as SpeedElimQuestion;
    const now = Date.now();
    state.collect.answers.set(playerId, {
      playerId,
      raw: { text },
      submittedAt: now,
    });
    const candidates = [q.answer, ...q.aliases];
    const correct = candidates.some((c) => equalsLoose(c, text));
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
      // rang de vitesse parmi les bonnes réponses
      const correctAnswers = players
        .map((p) => {
          const a = state.collect.kind === 'parallel' ? state.collect.answers.get(p.id) : undefined;
          return a && state.autoValidations[p.id]
            ? { pid: p.id, at: a.submittedAt }
            : null;
        })
        .filter((x): x is { pid: string; at: number } => x !== null)
        .sort((a, b) => a.at - b.at);
      const speedRankByPid = new Map<string, number>();
      correctAnswers.forEach((c, i) => speedRankByPid.set(c.pid, i + 1));
      for (const p of players) {
        const a = state.collect.answers.get(p.id);
        answers.push({
          playerId: p.id,
          text: a?.raw.text ?? '',
          answeredAt: a?.submittedAt,
          speedRank: speedRankByPid.get(p.id),
        });
      }
    }
    return {
      roundIndex: state.roundIndex,
      question: state.question,
      answers,
      autoValidations: { ...state.autoValidations },
    };
  },

  computeScores(state, players): RoundScoring {
    const q = state.question as SpeedElimQuestion;
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    const total = players.length;

    const ordered = players
      .map((p) => {
        const a = state.collect.kind === 'parallel' ? state.collect.answers.get(p.id) : undefined;
        return {
          pid: p.id,
          correct: !!state.autoValidations[p.id],
          at: a?.submittedAt ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((a, b) => {
        if (a.correct !== b.correct) return a.correct ? -1 : 1;
        return a.at - b.at;
      });

    ordered.forEach((entry, idx) => {
      const rank = total - idx; // premier joueur du tri => rank max
      const delta = speedElimScore({
        rank,
        total,
        difficulty: q.difficulty,
        correct: entry.correct,
      });
      deltas[entry.pid] = delta;
    });
    for (const p of players) {
      totals[p.id] = p.score + (deltas[p.id] ?? 0);
    }
    return {
      roundIndex: state.roundIndex,
      deltas,
      totals,
      officialAnswer: q.answer,
    };
  },
};

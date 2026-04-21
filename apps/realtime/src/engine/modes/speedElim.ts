import {
  type AnswerPayload,
  type Player,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
  type SpeedElimQuestion,
  DIFFICULTY_POINTS,
} from '@mvpc/shared';
import type { AcceptAnswerResult, GameMode, GameModeContext, RoundState } from '../types.js';
import { equalsLoose } from '../../util/text.js';

/**
 * Nombre de joueurs qui doivent trouver pour clore la manche.
 * On prend la moitié arrondie à l'entier supérieur : sur 5 joueurs → 3.
 */
export function speedElimFinderTarget(total: number): number {
  if (total <= 0) return 0;
  return Math.ceil(total / 2);
}

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
    const activeCount = ctx.players.length;
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'speed-elim',
      collect: {
        kind: 'speed-elim',
        se: {
          endsAt: ctx.now() + duration * 1000,
          targetFinders: speedElimFinderTarget(activeCount),
          attempts: new Map(),
          correctAt: new Map(),
          finderRank: new Map(),
        },
      },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  /**
   * Accepte une proposition texte. Un joueur peut retenter tant qu'il n'a
   * pas encore trouvé et que la manche n'est pas finie. Les mauvaises
   * propositions sont juste journalisées et n'ont aucune pénalité.
   */
  acceptAnswer(state, playerId, payload: AnswerPayload): AcceptAnswerResult {
    if (state.collect.kind !== 'speed-elim') {
      return { ok: false, code: 'PHASE_MISMATCH', message: 'Bad phase' };
    }
    const se = state.collect.se;
    const now = Date.now();
    if (se.finishedAt !== undefined || now >= se.endsAt) {
      return { ok: false, code: 'PHASE_MISMATCH', message: 'Manche terminée' };
    }
    if (se.correctAt.has(playerId)) {
      // Déjà trouvé, on ignore en douceur.
      return { ok: true, roundState: state, events: [] };
    }
    const text = payload.text?.trim() ?? '';
    if (!text) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Texte requis' };
    }
    const q = state.question as SpeedElimQuestion;
    const candidates = [q.answer, ...q.aliases];
    const correct = candidates.some((c) => equalsLoose(c, text));
    const list = se.attempts.get(playerId) ?? [];
    list.push({ text, at: now, correct });
    se.attempts.set(playerId, list);
    if (correct) {
      se.correctAt.set(playerId, now);
      state.autoValidations[playerId] = true;
      const rank = se.finderRank.size + 1;
      se.finderRank.set(playerId, rank);
      if (se.correctAt.size >= se.targetFinders) {
        se.finishedAt = now;
      }
      return {
        ok: true,
        roundState: state,
        events: [
          { type: 'player_answered', playerId },
          { type: 'speed_elim_attempt', playerId, correct: true },
        ],
      };
    }
    return {
      ok: true,
      roundState: state,
      events: [{ type: 'speed_elim_attempt', playerId, correct: false }],
    };
  },

  isCollectComplete(state, _activePlayers: Player[]) {
    if (state.collect.kind !== 'speed-elim') return true;
    const se = state.collect.se;
    if (se.finishedAt !== undefined) return true;
    if (Date.now() >= se.endsAt) return true;
    return se.correctAt.size >= se.targetFinders;
  },

  buildReveal(state, players): RoundReveal {
    const answers: RoundReveal['answers'] = [];
    if (state.collect.kind === 'speed-elim') {
      const se = state.collect.se;
      for (const p of players) {
        const at = se.correctAt.get(p.id);
        const rank = se.finderRank.get(p.id);
        const myAttempts = se.attempts.get(p.id) ?? [];
        // Pour le reveal on affiche la dernière tentative du joueur (la bonne
        // s'il a trouvé, sinon sa dernière proposition).
        const lastTry = myAttempts[myAttempts.length - 1];
        answers.push({
          playerId: p.id,
          text: lastTry?.text ?? '',
          answeredAt: at,
          speedRank: rank,
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
    const base = DIFFICULTY_POINTS[q.difficulty];
    if (state.collect.kind === 'speed-elim') {
      const se = state.collect.se;
      const targetFinders = Math.max(1, se.targetFinders);
      for (const p of players) {
        const rank = se.finderRank.get(p.id);
        if (rank === undefined) {
          deltas[p.id] = 0;
        } else {
          // Formule : plus tu es tôt dans le classement des finders, plus tu
          // marques. Le premier prend base*1.5, le dernier à trouver ~base*0.6.
          const share = 1 - (rank - 1) / targetFinders;
          const multiplier = 0.6 + share * 0.9;
          deltas[p.id] = Math.round(base * multiplier);
        }
        totals[p.id] = p.score + (deltas[p.id] ?? 0);
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
      officialAnswer: q.answer,
    };
  },
};

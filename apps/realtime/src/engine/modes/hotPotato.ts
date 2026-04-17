import {
  type AnswerPayload,
  type HotPotatoQuestion,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
  hotPotatoScore,
} from '@mvpc/shared';
import type {
  AcceptAnswerResult,
  GameMode,
  GameModeContext,
  HotPotatoPlayerState,
  RoundState,
} from '../types.js';
import { equalsLoose, normalize } from '../../util/text.js';

function initPlayers(players: { id: string }[]): Record<string, HotPotatoPlayerState> {
  const out: Record<string, HotPotatoPlayerState> = {};
  for (const p of players) {
    out[p.id] = { bid: undefined, items: [], done: false };
  }
  return out;
}

export const hotPotatoMode: GameMode = {
  id: 'hot-potato',

  prepare(ctx: GameModeContext, _defaultSeconds: number): RoundState {
    const q = ctx.question as HotPotatoQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'hot-potato',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
      bidSeconds: q.bidSeconds,
      timerSeconds: q.answerSeconds,
      maxBid: q.maxBid,
    };
    const now = ctx.now();
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'hot-potato',
      collect: {
        kind: 'hot-potato',
        hp: {
          phase: 'bid',
          bidEndsAt: now + q.bidSeconds * 1000,
          players: initPlayers(ctx.players),
          usedByPlayer: Object.fromEntries(ctx.players.map((p) => [p.id, new Set<string>()])),
        },
      },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(state, playerId, payload: AnswerPayload): AcceptAnswerResult {
    if (state.collect.kind !== 'hot-potato') {
      return { ok: false, code: 'PHASE_MISMATCH', message: 'Bad phase' };
    }
    const hp = state.collect.hp;
    const q = state.question as HotPotatoQuestion;
    const player = hp.players[playerId];
    if (!player) {
      return { ok: false, code: 'UNKNOWN_PLAYER', message: 'Joueur inconnu' };
    }

    if (hp.phase === 'bid') {
      if (typeof payload.bid !== 'number') {
        return { ok: false, code: 'INVALID_PAYLOAD', message: 'Bid requis' };
      }
      if (player.bid !== undefined) {
        return { ok: false, code: 'ALREADY_BID', message: 'Mise déjà posée' };
      }
      const bid = Math.max(1, Math.min(q.maxBid, Math.round(payload.bid)));
      player.bid = bid;
      return {
        ok: true,
        roundState: state,
        events: [{ type: 'hp_bid_placed', playerId, bid }],
      };
    }

    if (hp.phase === 'answer') {
      if (player.done) {
        return { ok: false, code: 'DONE', message: 'Joueur terminé' };
      }
      const raw = payload.listItem?.trim();
      if (!raw) {
        return { ok: false, code: 'INVALID_PAYLOAD', message: 'Item requis' };
      }
      const now = Date.now();
      if (player.endsAt && now > player.endsAt) {
        player.done = true;
        return {
          ok: true,
          roundState: state,
          events: [{ type: 'hp_player_done', playerId, success: false }],
        };
      }
      const used = hp.usedByPlayer[playerId]!;
      const norm = normalize(raw);
      if (used.has(norm)) {
        return {
          ok: true,
          roundState: state,
          events: [{ type: 'hp_item_rejected', playerId, reason: 'duplicate' }],
        };
      }
      const valid = q.validItems.some((v) => equalsLoose(v, raw));
      if (!valid) {
        return {
          ok: true,
          roundState: state,
          events: [{ type: 'hp_item_rejected', playerId, reason: 'invalid' }],
        };
      }
      used.add(norm);
      player.items.push(raw);
      const count = player.items.length;
      const events: any[] = [{ type: 'hp_item_accepted', playerId, item: raw, count }];
      if (player.bid && count >= player.bid) {
        player.done = true;
        events.push({ type: 'hp_player_done', playerId, success: true });
      }
      return { ok: true, roundState: state, events };
    }

    return { ok: false, code: 'PHASE_MISMATCH', message: 'Phase terminée' };
  },

  isCollectComplete(state, activePlayers) {
    if (state.collect.kind !== 'hot-potato') return true;
    const hp = state.collect.hp;
    const q = state.question as HotPotatoQuestion;
    const now = Date.now();

    if (hp.phase === 'bid') {
      const allBid = activePlayers.every((p) => hp.players[p.id]?.bid !== undefined);
      if (allBid || now >= hp.bidEndsAt) {
        for (const p of activePlayers) {
          const state = hp.players[p.id];
          if (!state) continue;
          if (state.bid === undefined) {
            state.bid = Math.min(3, q.maxBid); // bid par défaut
          }
          state.startedAt = now;
          state.endsAt = now + q.answerSeconds * 1000;
        }
        hp.phase = 'answer';
        hp.answerEndsAt = now + q.answerSeconds * 1000;
      }
      return false;
    }

    if (hp.phase === 'answer') {
      const allDone = activePlayers.every((p) => hp.players[p.id]?.done);
      if (allDone) return true;
      if (hp.answerEndsAt && now >= hp.answerEndsAt) {
        for (const p of activePlayers) {
          const st = hp.players[p.id];
          if (st && !st.done) st.done = true;
        }
        return true;
      }
      return false;
    }
    return true;
  },

  buildReveal(state, players): RoundReveal {
    const answers: RoundReveal['answers'] = [];
    if (state.collect.kind === 'hot-potato') {
      for (const p of players) {
        const s = state.collect.hp.players[p.id];
        const bid = s?.bid;
        const count = s?.items.length ?? 0;
        answers.push({
          playerId: p.id,
          listItems: s?.items ?? [],
          bid,
          success: bid !== undefined && count >= bid,
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
    const q = state.question as HotPotatoQuestion;
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    if (state.collect.kind === 'hot-potato') {
      for (const p of players) {
        const s = state.collect.hp.players[p.id];
        const bid = s?.bid ?? 0;
        const found = s?.items.length ?? 0;
        const delta = hotPotatoScore({ bid, found, difficulty: q.difficulty });
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
      officialAnswer: `${q.validItems.length} réponses valides`,
    };
  },
};

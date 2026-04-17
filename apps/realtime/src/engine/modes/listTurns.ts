import {
  type ListTurnsQuestion,
  type Player,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
  listTurnsScores,
} from '@mvpc/shared';
import type {
  AcceptAnswerResult,
  GameMode,
  GameModeContext,
  RoundEvent,
  RoundState,
  TurnState,
} from '../types.js';
import { normalize } from '../../util/text.js';

function playerOrder(players: Player[], seed: number): string[] {
  // Mélange déterministe basé sur roundIndex pour éviter que le même commence.
  const arr = players.map((p) => p.id);
  const rng = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextAlive(order: string[], eliminated: Set<string>, from: string): string | null {
  const idx = order.indexOf(from);
  if (idx < 0) return null;
  for (let i = 1; i <= order.length; i++) {
    const cand = order[(idx + i) % order.length]!;
    if (!eliminated.has(cand)) return cand;
  }
  return null;
}

export function listTurnsTick(
  state: RoundState,
  players: Player[],
): { expired: boolean; events: RoundEvent[] } {
  if (state.collect.kind !== 'turns') return { expired: false, events: [] };
  if (Date.now() < state.collect.turn.endsAt) return { expired: false, events: [] };
  return eliminateCurrent(state, players, 'timeout');
}

function eliminateCurrent(
  state: RoundState,
  players: Player[],
  reason: 'duplicate' | 'invalid' | 'timeout',
): { expired: boolean; events: RoundEvent[] } {
  if (state.collect.kind !== 'turns') return { expired: false, events: [] };
  const turn = state.collect.turn;
  const order = playerOrder(players, state.roundIndex + 7);
  const eliminated = new Set<string>(turn.eliminatedOrder);
  eliminated.add(turn.currentPlayerId);
  const events: RoundEvent[] = [
    { type: 'eliminated', playerId: turn.currentPlayerId, reason },
  ];
  turn.eliminatedOrder.push(turn.currentPlayerId);

  // Le joueur éliminé était déjà en ultime tour : fin définitive.
  if (turn.finalLast) {
    return { expired: true, events };
  }

  const nextPlayerId = nextAlive(order, eliminated, turn.currentPlayerId);
  const activeCount = players.length - eliminated.size;
  if (!nextPlayerId || activeCount < 1) {
    return { expired: true, events };
  }

  const q = state.question as ListTurnsQuestion;

  if (activeCount === 1) {
    // Il reste un seul joueur. Si personne n'a encore trouvé une bonne réponse,
    // on lui laisse un ultime tour pour marquer (0 bonne réponse = 0 point).
    const totalCorrect = Object.values(turn.correctContributions).reduce(
      (a, b) => a + b,
      0,
    );
    if (totalCorrect === 0) {
      turn.finalLast = true;
      turn.currentPlayerId = nextPlayerId;
      turn.endsAt = Date.now() + (q.turnSeconds ?? 15) * 1000;
      events.push({
        type: 'turn_started',
        currentPlayerId: nextPlayerId,
        endsAt: turn.endsAt,
      });
      return { expired: false, events };
    }
    // Quelqu'un a déjà marqué : le survivant encaisse ses points, fin de manche.
    return { expired: true, events };
  }

  turn.currentPlayerId = nextPlayerId;
  turn.endsAt = Date.now() + (q.turnSeconds ?? 15) * 1000;
  events.push({ type: 'turn_started', currentPlayerId: nextPlayerId, endsAt: turn.endsAt });
  return { expired: false, events };
}

export const listTurnsMode: GameMode = {
  id: 'list-turns',

  prepare(ctx: GameModeContext): RoundState {
    const q = ctx.question as ListTurnsQuestion;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'list-turns',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
      turnSeconds: q.turnSeconds,
    };
    const order = playerOrder(ctx.players, ctx.roundIndex + 7);
    const firstId = order[0]!;
    const turn: TurnState = {
      currentPlayerId: firstId,
      endsAt: ctx.now() + (q.turnSeconds ?? 15) * 1000,
      eliminatedOrder: [],
      usedItems: [],
      correctContributions: {},
    };
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'list-turns',
      collect: { kind: 'turns', turn },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(state, playerId, payload): AcceptAnswerResult {
    if (state.collect.kind !== 'turns') {
      return { ok: false, code: 'PHASE_MISMATCH', message: 'Bad phase' };
    }
    const turn = state.collect.turn;
    if (turn.currentPlayerId !== playerId) {
      return { ok: false, code: 'NOT_YOUR_TURN', message: "Ce n'est pas ton tour" };
    }
    const q = state.question as ListTurnsQuestion;
    const raw = (payload.listItem ?? payload.text ?? '').trim();
    if (!raw) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Réponse vide' };
    }
    const normalized = normalize(raw);
    const alreadyUsed = turn.usedItems.includes(normalized);
    const validSet = q.validItems.map(normalize);
    const isValid = validSet.includes(normalized);

    const events: RoundEvent[] = [{ type: 'player_answered', playerId }];

    if (alreadyUsed) {
      const elim = eliminateCurrent(state, _currentPlayers(state), 'duplicate');
      return { ok: true, roundState: state, events: [...events, ...elim.events] };
    }
    if (!isValid) {
      const elim = eliminateCurrent(state, _currentPlayers(state), 'invalid');
      return { ok: true, roundState: state, events: [...events, ...elim.events] };
    }

    // Bonne réponse : compte la contribution.
    turn.usedItems.push(normalized);
    turn.correctContributions[playerId] = (turn.correctContributions[playerId] ?? 0) + 1;

    // Si c'était l'ultime tour du dernier survivant, la manche se termine sur cette bonne réponse.
    if (turn.finalLast) {
      return { ok: true, roundState: state, events };
    }

    const players = _currentPlayers(state);
    const order = playerOrder(players, state.roundIndex + 7);
    const eliminated = new Set(turn.eliminatedOrder);
    const nextId = nextAlive(order, eliminated, playerId);
    if (nextId && players.length - eliminated.size > 1) {
      turn.currentPlayerId = nextId;
      turn.endsAt = Date.now() + (q.turnSeconds ?? 15) * 1000;
      events.push({ type: 'turn_started', currentPlayerId: nextId, endsAt: turn.endsAt });
    }
    return { ok: true, roundState: state, events };
  },

  isCollectComplete(state, activePlayers) {
    if (state.collect.kind !== 'turns') return true;
    const turn = state.collect.turn;
    const alive = activePlayers.length - turn.eliminatedOrder.length;
    if (alive <= 0) return true;
    if (turn.finalLast) {
      // En ultime tour, la manche se clôt dès que le survivant a marqué
      // (ou qu'il a été éliminé, auquel cas alive vaut 0 ci-dessus).
      const totalCorrect = Object.values(turn.correctContributions).reduce(
        (a, b) => a + b,
        0,
      );
      return totalCorrect > 0;
    }
    return alive <= 1;
  },

  buildReveal(state, players): RoundReveal {
    const answers: RoundReveal['answers'] = [];
    if (state.collect.kind === 'turns') {
      const q = state.question as ListTurnsQuestion;
      for (const p of players) {
        const correctCount = state.collect.turn.correctContributions[p.id] ?? 0;
        answers.push({
          playerId: p.id,
          listItems: [`${correctCount} bonne(s) réponse(s)`],
        });
      }
      return {
        roundIndex: state.roundIndex,
        question: state.question,
        answers,
        autoValidations: {},
        eliminationOrder: [...state.collect.turn.eliminatedOrder],
      };
    }
    return {
      roundIndex: state.roundIndex,
      question: state.question,
      answers,
      autoValidations: {},
    };
  },

  computeScores(state, players): RoundScoring {
    const q = state.question as ListTurnsQuestion;
    if (state.collect.kind !== 'turns') {
      return {
        roundIndex: state.roundIndex,
        deltas: {},
        totals: Object.fromEntries(players.map((p) => [p.id, p.score])),
        officialAnswer: q.validItems.join(', '),
      };
    }
    const eliminated = new Set(state.collect.turn.eliminatedOrder);
    const survivors = players.filter((p) => !eliminated.has(p.id)).map((p) => p.id);
    const scoreMap = listTurnsScores({
      survivors,
      eliminationOrder: state.collect.turn.eliminatedOrder,
      difficulty: q.difficulty,
      correctContributions: state.collect.turn.correctContributions,
    });
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
      officialAnswer: q.validItems.slice(0, 8).join(', ') + (q.validItems.length > 8 ? '…' : ''),
    };
  },
};

// Les modules en tours ont besoin de connaître la liste actuelle des joueurs.
// Le serveur l'injecte via un WeakMap avant chaque acceptAnswer.
const _playersByState = new WeakMap<RoundState, Player[]>();

export function setRoundPlayers(state: RoundState, players: Player[]) {
  _playersByState.set(state, players);
}

function _currentPlayers(state: RoundState): Player[] {
  return _playersByState.get(state) ?? [];
}

import {
  type Player,
  type PublicQuestion,
  type RoundReveal,
  type RoundScoring,
  type WikiraceQuestion,
} from '@mvpc/shared';
import type {
  AcceptAnswerResult,
  GameMode,
  GameModeContext,
  RoundState,
  WikiracePlayerState,
  WikiraceState,
} from '../types.js';

/** Normalise un titre Wikipédia pour comparaison (insensible à la casse et aux underscores). */
export function normalizeWikiTitle(raw: string): string {
  try {
    return decodeURIComponent(raw)
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  } catch {
    return raw.replace(/_/g, ' ').trim().toLowerCase();
  }
}

/**
 * Récompense par rang d'arrivée. Les abandons / déconnexions rapportent 0
 * même si le mode est joué en match unique — pratique pour un éventuel
 * cumul multi-manches ou pour le classement final.
 */
const FINISH_POINTS = [10, 7, 5, 3, 2, 1];

export const wikiraceMode: GameMode = {
  id: 'wikirace',

  prepare(ctx: GameModeContext): RoundState {
    const q = ctx.question as WikiraceQuestion;
    const wikiLang = q.wikiLang ?? 'fr';
    const startTitle = q.startTitle;
    const targetTitle = q.targetTitle;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'wikirace',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
      wrStartTitle: startTitle,
      wrTargetTitle: targetTitle,
      wrWikiLang: wikiLang,
    };
    const now = ctx.now();
    const players = new Map<string, WikiracePlayerState>();
    for (const p of ctx.players) {
      players.set(p.id, {
        status: 'running',
        path: [startTitle],
        startedAt: now,
      });
    }
    const wr: WikiraceState = {
      startTitle,
      targetTitle,
      wikiLang,
      startedAt: now,
      players,
      ended: false,
    };
    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'wikirace',
      collect: { kind: 'wikirace', wr },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(): AcceptAnswerResult {
    return {
      ok: false,
      code: 'PHASE_MISMATCH',
      message: 'wikirace utilise ses propres events',
    };
  },

  isCollectComplete(state, players): boolean {
    if (state.collect.kind !== 'wikirace') return true;
    const wr = state.collect.wr;
    if (wr.ended) return true;
    const connectedIds = new Set(players.filter((p) => p.connected).map((p) => p.id));
    // Synchronise le statut 'disconnected' pour tout joueur qui n'est plus en ligne.
    for (const [pid, ps] of wr.players.entries()) {
      if (ps.status === 'running' && !connectedIds.has(pid)) {
        ps.status = 'disconnected';
      }
    }
    const anyoneStillRunning = [...wr.players.values()].some((p) => p.status === 'running');
    if (!anyoneStillRunning) {
      wr.ended = true;
      return true;
    }
    return false;
  },

  buildReveal(state, players): RoundReveal {
    const answers: RoundReveal['answers'] = [];
    if (state.collect.kind === 'wikirace') {
      const wr = state.collect.wr;
      for (const p of players) {
        const ps = wr.players.get(p.id);
        if (!ps) continue;
        const durationMs =
          ps.finishedAt !== undefined ? ps.finishedAt - ps.startedAt : undefined;
        answers.push({
          playerId: p.id,
          // `listItems` stocke le chemin complet (titres normalisés) pour le reveal.
          listItems: [...ps.path],
          // `numeric` = durée en ms pour les arrivants (sinon undefined).
          numeric: durationMs,
          success: ps.status === 'finished',
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
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    let officialAnswer = '';
    if (state.collect.kind === 'wikirace') {
      const wr = state.collect.wr;
      officialAnswer = wr.targetTitle;
      // Classement par temps d'arrivée (plus petit = mieux).
      const finishers = [...wr.players.entries()]
        .filter(([, s]) => s.status === 'finished' && s.finishedAt !== undefined)
        .sort((a, b) => (a[1].finishedAt! - a[1].startedAt) - (b[1].finishedAt! - b[1].startedAt));
      for (const p of players) {
        const ps = wr.players.get(p.id);
        if (!ps || ps.status !== 'finished') {
          deltas[p.id] = 0;
          totals[p.id] = p.score;
          continue;
        }
        const rank = finishers.findIndex(([pid]) => pid === p.id);
        const delta = rank >= 0 ? FINISH_POINTS[rank] ?? 1 : 0;
        deltas[p.id] = delta;
        totals[p.id] = p.score + delta;
      }
    }
    for (const p of players) {
      if (deltas[p.id] === undefined) {
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

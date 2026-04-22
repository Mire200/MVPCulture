import type {
  AcceptAnswerResult,
  BombpartyState,
  GameMode,
  GameModeContext,
  RoundState,
} from '../types.js';
import type {
  AnswerPayload,
  BombpartyQuestion,
  PublicQuestion,
  RoundReveal,
  RoundScoring,
} from '@mvpc/shared';
import { isValidWord, getRandomSyllable, normalizeWord } from '@mvpc/content';

export const bombpartyMode: GameMode = {
  id: 'bombparty',
  
  prepare(ctx: GameModeContext, defaultSeconds: number): RoundState {
    const q = ctx.question as BombpartyQuestion;
    const initialLives = q.initialLives ?? 3;
    const playerOrder = ctx.players.map(p => p.id);
    
    const lives: Record<string, number> = {};
    const alphabets: Record<string, Set<string>> = {};
    for (const p of ctx.players) {
      lives[p.id] = initialLives;
      alphabets[p.id] = new Set();
    }
    
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'bombparty',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt || 'Bombparty!',
      timerSeconds: 0,
    };

    const firstPlayerId = playerOrder[0] ?? null;
    const timerMs = 10000;

    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'bombparty',
      collect: {
        kind: 'bombparty',
        bp: {
          playerOrder,
          currentPlayerId: firstPlayerId,
          timerMs,
          explodesAt: ctx.now() + timerMs,
          syllable: getRandomSyllable(),
          lives,
          alphabets,
          usedWords: new Set(),
          phase: 'playing',
        }
      },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(state, playerId, payload: AnswerPayload): AcceptAnswerResult {
    if (state.collect.kind !== 'bombparty') return { ok: false, code: 'PHASE_MISMATCH', message: 'Mauvaise phase' };
    const bp = state.collect.bp;
    
    if (bp.phase !== 'playing') return { ok: false, code: 'PHASE_MISMATCH', message: 'Terminé' };
    if (bp.currentPlayerId !== playerId) return { ok: false, code: 'NOT_YOUR_TURN', message: "Ce n'est pas ton tour !" };
    
    const rawWord = payload.text;
    if (!rawWord) return { ok: false, code: 'INVALID_PAYLOAD', message: 'Mot manquant' };
    
    const norm = normalizeWord(rawWord);
    const sylNorm = normalizeWord(bp.syllable);
    
    if (!norm.includes(sylNorm)) {
      return { ok: true, roundState: state, events: [{ type: 'bp_invalid_syllable', playerId, word: rawWord }] };
    }
    
    if (bp.usedWords.has(norm)) {
      return { ok: true, roundState: state, events: [{ type: 'bp_already_used', playerId, word: rawWord }] };
    }
    
    if (!isValidWord(norm)) {
      return { ok: true, roundState: state, events: [{ type: 'bp_not_in_dict', playerId, word: rawWord }] };
    }
    
    // Valid word
    bp.usedWords.add(norm);
    
    // Alphabet logic
    const alphabetSet = bp.alphabets[playerId];
    if (alphabetSet) {
      for (const char of norm) {
        if (/[a-z]/.test(char)) {
          alphabetSet.add(char);
        }
      }
      if (alphabetSet.size >= 26) {
        bp.lives[playerId] = (bp.lives[playerId] ?? 0) + 1;
        alphabetSet.clear();
      }
    }
    
    // Next player
    const currentIndex = bp.playerOrder.indexOf(playerId);
    let nextIndex = (currentIndex + 1) % bp.playerOrder.length;
    let loops = 0;
    while ((bp.lives[bp.playerOrder[nextIndex]!] ?? 0) <= 0 && loops < bp.playerOrder.length) {
       nextIndex = (nextIndex + 1) % bp.playerOrder.length;
       loops++;
    }
    
    bp.currentPlayerId = bp.playerOrder[nextIndex] ?? null;
    bp.syllable = getRandomSyllable();
    // Accélération de 10% à chaque tour réussi, minimum 2 secondes (très rapide !)
    bp.timerMs = Math.max(2000, bp.timerMs * 0.9);
    bp.explodesAt = Date.now() + bp.timerMs;
    
    return {
      ok: true,
      roundState: state,
      events: [{ type: 'bp_word_accepted', playerId, word: rawWord }],
    };
  },

  isCollectComplete(state, activePlayers) {
    if (state.collect.kind !== 'bombparty') return true;
    return state.collect.bp.phase === 'done';
  },

  buildReveal(state, players): RoundReveal {
    return {
      roundIndex: state.roundIndex,
      question: state.question,
      answers: [],
      autoValidations: {},
    };
  },

  computeScores(state, players): RoundScoring {
    const deltas: Record<string, number> = {};
    const totals: Record<string, number> = {};
    
    if (state.collect.kind === 'bombparty') {
      const bp = state.collect.bp;
      // Determine rank by who died when. A simple version: alive = winner
      let aliveCount = 0;
      let winnerId = null;
      for (const p of players) {
        const remaining = bp.lives[p.id] ?? 0;
        if (remaining > 0) {
          aliveCount++;
          winnerId = p.id;
        }
      }
      
      for (const p of players) {
        let delta = 0;
        if (p.id === winnerId && aliveCount === 1) delta = 1000;
        else if ((bp.lives[p.id] ?? 0) > 0) delta = 500; // Solo survival mode ?
        
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
      officialAnswer: 'Bombparty',
    };
  }
};

export function bpTick(bp: BombpartyState, now: number): { advanced: boolean; completed: boolean; explodeEvents: any[] } {
  if (bp.phase === 'done') return { advanced: false, completed: true, explodeEvents: [] };
  
  if (now >= bp.explodesAt && bp.currentPlayerId) {
    const pId = bp.currentPlayerId;
    bp.lives[pId] = Math.max(0, (bp.lives[pId] ?? 1) - 1);
    
    const explodeEvents = [{ type: 'bp_explosion', playerId: pId }];
    
    const aliveCount = bp.playerOrder.filter(id => (bp.lives[id] ?? 0) > 0).length;
    
    if (aliveCount <= 1) {
      bp.phase = 'done';
      return { advanced: true, completed: true, explodeEvents };
    }
    
    let nextIndex = (bp.playerOrder.indexOf(pId) + 1) % bp.playerOrder.length;
    
    let loops = 0;
    while ((bp.lives[bp.playerOrder[nextIndex]!] ?? 0) <= 0 && loops < bp.playerOrder.length) {
       nextIndex = (nextIndex + 1) % bp.playerOrder.length;
       loops++;
    }
    
    bp.currentPlayerId = bp.playerOrder[nextIndex] ?? null;
    bp.syllable = getRandomSyllable();
    bp.timerMs = 10000; // Reset timer
    bp.explodesAt = now + bp.timerMs;
    
    return { advanced: true, completed: false, explodeEvents };
  }
  
  return { advanced: false, completed: false, explodeEvents: [] };
}

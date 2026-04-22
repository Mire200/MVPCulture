import type {
  Player,
  PublicQuestion,
  RoundReveal,
  RoundScoring,
} from '@mvpc/shared';
import type {
  AcceptAnswerResult,
  GameMode,
  GameModeContext,
  GarticPhoneEntry,
  GarticPhoneState,
  RoundState,
} from '../types.js';

/** Durées par défaut (ms). */
export const GP_WRITE_MS = 45_000;
export const GP_DRAW_MS = 90_000;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Quel est le chain-owner dont le joueur doit continuer la chaîne à l'étape `stepIndex` ?
 * À l'étape 0, chaque joueur travaille sur sa propre chaîne.
 * À l'étape k, le joueur à l'index i travaille sur la chaîne du joueur à l'index (i - k) mod N.
 */
function chainOwnerForPlayer(gp: GarticPhoneState, playerId: string): string | undefined {
  const idx = gp.playerOrder.indexOf(playerId);
  if (idx < 0) return undefined;
  const N = gp.playerOrder.length;
  const ownerIdx = ((idx - gp.stepIndex) % N + N) % N;
  return gp.playerOrder[ownerIdx];
}

/**
 * Retourne le prompt privé pour le joueur à l'étape courante :
 * - En phase write : pas de prompt (le joueur invente)
 * - En phase draw : le dernier texte de la chaîne qu'il doit dessiner
 * - En phase guess : le dernier dessin de la chaîne qu'il doit deviner
 */
export function gpPromptFor(
  gp: GarticPhoneState,
  playerId: string,
): { type: 'text' | 'drawing'; content: string } | undefined {
  if (gp.sub === 'write' || gp.sub === 'reveal' || gp.sub === 'done') return undefined;
  const owner = chainOwnerForPlayer(gp, playerId);
  if (!owner) return undefined;
  const chain = gp.chains.get(owner);
  if (!chain || chain.length === 0) return undefined;
  const last = chain[chain.length - 1]!;
  return { type: last.type, content: last.content };
}

/** Sous-phase attendue pour l'étape donnée. */
function subForStep(step: number): 'write' | 'draw' | 'guess' {
  if (step === 0) return 'write';
  return step % 2 === 1 ? 'draw' : 'guess';
}

/** Durée de l'étape courante (ms). */
function msForStep(gp: GarticPhoneState): number {
  const s = subForStep(gp.stepIndex);
  return s === 'draw' ? gp.drawMs : gp.writeMs;
}

/** Avance à l'étape suivante ou passe en reveal. */
function advanceStep(gp: GarticPhoneState, now: number): void {
  // Pour les joueurs qui n'ont pas soumis, on met un contenu vide.
  for (const pid of gp.playerOrder) {
    if (!gp.submitted.has(pid)) {
      const owner = chainOwnerForPlayer({ ...gp, stepIndex: gp.stepIndex } as GarticPhoneState, pid);
      if (owner) {
        const chain = gp.chains.get(owner);
        const expectedType = subForStep(gp.stepIndex) === 'draw' ? 'drawing' : 'text';
        const entry: GarticPhoneEntry = {
          type: expectedType,
          playerId: pid,
          content: expectedType === 'text' ? '(pas de réponse)' : '',
          submittedAt: now,
        };
        chain?.push(entry);
      }
    }
  }

  gp.stepIndex++;
  gp.submitted = new Set();

  if (gp.stepIndex >= gp.totalSteps) {
    gp.sub = 'reveal';
    gp.revealChainIndex = 0;
    gp.revealStepIndex = 1;
    gp.endsAt = now;
    return;
  }

  gp.sub = subForStep(gp.stepIndex);
  gp.endsAt = now + msForStep(gp);
}

/**
 * Soumission d'un texte (phase write ou guess).
 */
export function gpSubmitText(
  gp: GarticPhoneState,
  playerId: string,
  text: string,
  now: number,
): { accepted: boolean; code?: string } {
  if (gp.sub !== 'write' && gp.sub !== 'guess') {
    return { accepted: false, code: 'PHASE_MISMATCH' };
  }
  if (!gp.playerOrder.includes(playerId)) {
    return { accepted: false, code: 'NOT_IN_ROOM' };
  }
  if (gp.submitted.has(playerId)) {
    return { accepted: false, code: 'ALREADY_ANSWERED' };
  }

  const owner = chainOwnerForPlayer(gp, playerId);
  if (!owner) return { accepted: false, code: 'INTERNAL' };

  const chain = gp.chains.get(owner)!;
  chain.push({
    type: 'text',
    playerId,
    content: text.trim().slice(0, 200),
    submittedAt: now,
  });

  gp.submitted.add(playerId);

  if (gp.submitted.size >= gp.playerOrder.length) {
    advanceStep(gp, now);
  }

  return { accepted: true };
}

/**
 * Soumission d'un dessin (phase draw).
 */
export function gpSubmitDrawing(
  gp: GarticPhoneState,
  playerId: string,
  dataUrl: string,
  now: number,
): { accepted: boolean; code?: string } {
  if (gp.sub !== 'draw') {
    return { accepted: false, code: 'PHASE_MISMATCH' };
  }
  if (!gp.playerOrder.includes(playerId)) {
    return { accepted: false, code: 'NOT_IN_ROOM' };
  }
  if (gp.submitted.has(playerId)) {
    return { accepted: false, code: 'ALREADY_ANSWERED' };
  }

  const owner = chainOwnerForPlayer(gp, playerId);
  if (!owner) return { accepted: false, code: 'INTERNAL' };

  const chain = gp.chains.get(owner)!;
  chain.push({
    type: 'drawing',
    playerId,
    content: dataUrl,
    submittedAt: now,
  });

  gp.submitted.add(playerId);

  if (gp.submitted.size >= gp.playerOrder.length) {
    advanceStep(gp, now);
  }

  return { accepted: true };
}

/**
 * Tick — gère les timeouts. Avance l'étape si le timer est expiré.
 */
export function gpTick(
  gp: GarticPhoneState,
  now: number,
): { advanced: boolean; completed: boolean } {
  if (gp.sub === 'done' || gp.sub === 'reveal') {
    return { advanced: false, completed: gp.sub === 'done' };
  }
  if (now < gp.endsAt) return { advanced: false, completed: false };

  advanceStep(gp, now);
  const newSub = gp.sub as string;
  return {
    advanced: true,
    completed: newSub === 'reveal' || newSub === 'done',
  };
}

/**
 * Avance la révélation d'une étape (demandé par l'hôte).
 */
export function gpAdvanceReveal(
  gp: GarticPhoneState,
  now: number,
): { accepted: boolean; completed: boolean; code?: string } {
  if (gp.sub !== 'reveal') {
    return { accepted: false, completed: false, code: 'PHASE_MISMATCH' };
  }

  const owner = gp.playerOrder[gp.revealChainIndex];
  if (!owner) return { accepted: false, completed: false, code: 'INTERNAL' };
  
  const chain = gp.chains.get(owner) ?? [];
  gp.revealStepIndex++;

  // Si on a tout révélé de la chaîne actuelle
  if (gp.revealStepIndex > chain.length) {
    gp.revealChainIndex++;
    gp.revealStepIndex = 1;
  }

  // Si toutes les chaînes ont été révélées
  if (gp.revealChainIndex >= gp.totalSteps) {
    gp.sub = 'done';
    gp.endsAt = now;
    return { accepted: true, completed: true };
  }

  return { accepted: true, completed: false };
}

export const garticPhoneMode: GameMode = {
  id: 'gartic-phone',

  prepare(ctx: GameModeContext): RoundState {
    const q = ctx.question;
    const publicQuestion: PublicQuestion = {
      id: q.id,
      mode: 'gartic-phone',
      difficulty: q.difficulty,
      category: q.category,
      prompt: q.prompt,
    };

    const seed = ctx.roundIndex + 42 + ctx.players.length * 13;
    const rng = mulberry32(seed);
    const order = shuffled(
      ctx.players.map((p) => p.id),
      rng,
    );

    const now = ctx.now();
    const chains = new Map<string, GarticPhoneEntry[]>();
    for (const pid of order) {
      chains.set(pid, []);
    }

    const gp: GarticPhoneState = {
      sub: 'write',
      playerOrder: order,
      stepIndex: 0,
      totalSteps: order.length,
      chains,
      submitted: new Set(),
      endsAt: now + GP_WRITE_MS,
      writeMs: GP_WRITE_MS,
      drawMs: GP_DRAW_MS,
      revealChainIndex: 0,
      revealStepIndex: 0,
    };

    return {
      roundIndex: ctx.roundIndex,
      question: q,
      publicQuestion,
      mode: 'gartic-phone',
      collect: { kind: 'gartic-phone', gp },
      autoValidations: {},
      hostValidations: {},
      revealed: false,
    };
  },

  acceptAnswer(): AcceptAnswerResult {
    return {
      ok: false,
      code: 'PHASE_MISMATCH',
      message: 'gartic-phone utilise ses propres events',
    };
  },

  isCollectComplete(state): boolean {
    if (state.collect.kind !== 'gartic-phone') return true;
    return state.collect.gp.sub === 'done';
  },

  buildReveal(state, players): RoundReveal {
    const answers: RoundReveal['answers'] = [];
    if (state.collect.kind === 'gartic-phone') {
      // On crée une "réponse" par joueur (initiateur de chaîne)
      // avec le premier texte comme `text` pour le reveal standard.
      const gp = state.collect.gp;
      for (const p of players) {
        const chain = gp.chains.get(p.id);
        const firstText = chain?.find((e) => e.type === 'text')?.content ?? '';
        answers.push({
          playerId: p.id,
          text: firstText,
          listItems: chain?.map((e) => `${e.type}:${e.playerId}`) ?? [],
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
    // Mode fun : 0 points pour tout le monde.
    for (const p of players) {
      deltas[p.id] = 0;
      totals[p.id] = p.score;
    }
    return {
      roundIndex: state.roundIndex,
      deltas,
      totals,
      officialAnswer: 'Gartic Phone',
    };
  },
};

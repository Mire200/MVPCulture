import { ALL_QUESTIONS } from '@mvpc/content';
import type { GameConfig, GameModeId, Question } from '@mvpc/shared';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function matchesDifficulty(q: Question, diff: GameConfig['difficulty']): boolean {
  if (diff === 'mixed') return true;
  return q.difficulty === diff;
}

function matchesCategory(q: Question, categoriesPool: string[] | undefined): boolean {
  if (!categoriesPool || categoriesPool.length === 0) return true;
  return categoriesPool.includes(q.category);
}

/**
 * Construit une playlist de N questions en alternant les modes du pool configuré.
 * Si `categoriesPool` est fourni et non vide, filtre aussi par catégorie (avec fallback).
 */
export function buildRoundPlaylist(config: GameConfig): Question[] {
  const pool = config.modesPool;
  const catPool = config.categoriesPool ?? [];
  const playlist: Question[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < config.rounds; i++) {
    const mode: GameModeId = pool[i % pool.length]!;
    const strict = ALL_QUESTIONS.filter(
      (q) =>
        q.mode === mode &&
        matchesDifficulty(q, config.difficulty) &&
        matchesCategory(q, catPool) &&
        !usedIds.has(q.id),
    );
    const catOnly = ALL_QUESTIONS.filter(
      (q) => q.mode === mode && matchesCategory(q, catPool) && !usedIds.has(q.id),
    );
    const modeOnly = ALL_QUESTIONS.filter((q) => q.mode === mode && !usedIds.has(q.id));
    const pickable =
      strict.length > 0 ? strict : catOnly.length > 0 ? catOnly : modeOnly;
    if (pickable.length === 0) {
      // Pas assez de questions : on autorise la répétition.
      const any = ALL_QUESTIONS.filter((q) => q.mode === mode);
      if (any.length === 0) continue;
      const q = pickRandom(any);
      playlist.push(q);
      continue;
    }
    const q = pickRandom(pickable);
    usedIds.add(q.id);
    playlist.push(q);
  }
  return playlist;
}

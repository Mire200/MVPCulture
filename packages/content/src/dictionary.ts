import mots from './data/mots.json' with { type: 'json' };
import sylData from './data/syllables.json' with { type: 'json' };

const wordsSet = new Set(mots as string[]);
const syllables = sylData as string[];

/**
 * Normalise un mot : minuscules, sans accents.
 */
export function normalizeWord(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Vérifie si un mot est valide (existe dans le dictionnaire).
 */
export function isValidWord(word: string): boolean {
  return wordsSet.has(normalizeWord(word));
}

/**
 * Tire une syllabe aléatoire parmi celles valides.
 */
export function getRandomSyllable(): string {
  const index = Math.floor(Math.random() * syllables.length);
  return syllables[index]!.toUpperCase();
}

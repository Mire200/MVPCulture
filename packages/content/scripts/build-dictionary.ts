import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const INPUT_FILE = path.join(DATA_DIR, 'french.json');
const WORDS_OUT = path.join(DATA_DIR, 'mots.json');
const SYLLABLES_OUT = path.join(DATA_DIR, 'syllables.json');

function normalize(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

async function build() {
  console.log('Loading french.json...');
  const rawWords: string[] = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  console.log(`Loaded ${rawWords.length} raw words.`);

  const validWords = new Set<string>();

  for (const raw of rawWords) {
    const norm = normalize(raw);
    // Keep only a-z, length >= 3
    if (/^[a-z]{3,}$/.test(norm)) {
      validWords.add(norm);
    }
  }

  const wordsArray = Array.from(validWords);
  console.log(`Filtered down to ${wordsArray.length} unique valid words.`);

  // Extract syllables (bigrams and trigrams)
  const syllableCounts = new Map<string, number>();

  for (const word of wordsArray) {
    const wordSyllables = new Set<string>();
    for (let i = 0; i < word.length - 1; i++) {
      wordSyllables.add(word.substring(i, i + 2));
      if (i < word.length - 2) {
        wordSyllables.add(word.substring(i, i + 3));
      }
    }

    for (const syl of wordSyllables) {
      syllableCounts.set(syl, (syllableCounts.get(syl) ?? 0) + 1);
    }
  }

  // Filter syllables: keep those present in at least 50 words
  const validSyllables: string[] = [];
  for (const [syl, count] of syllableCounts.entries()) {
    if (count >= 50) {
      validSyllables.push(syl);
    }
  }

  console.log(`Extracted ${validSyllables.length} valid syllables.`);

  fs.writeFileSync(WORDS_OUT, JSON.stringify(wordsArray));
  fs.writeFileSync(SYLLABLES_OUT, JSON.stringify(validSyllables));

  console.log('Done building dictionary data.');
}

build().catch(console.error);

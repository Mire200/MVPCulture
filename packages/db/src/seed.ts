import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Monorepo : le .env est en général à la racine ; Prisma/CLI ne le charge pas depuis packages/db.
loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../../.env'), override: true });

const prisma = new PrismaClient();

// Résout le package @mvpc/content même sans build (monorepo dev).
const CONTENT_DIR = resolve(__dirname, '../../content/seed');

type RawQuestion = {
  id: string;
  mode:
    | 'classic'
    | 'estimation'
    | 'list-turns'
    | 'hot-potato'
    | 'speed-elim'
    | 'map'
    | 'chronology';
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  prompt: string;
  answer?: string;
  aliases?: string[];
  numericAnswer?: number;
  unit?: string;
  validItems?: string[];
  turnSeconds?: number;
  timerSeconds?: number;
  bidSeconds?: number;
  maxBid?: number;
  targetLat?: number;
  targetLng?: number;
  targetLabel?: string;
  maxKm?: number;
  events?: Array<{ id: string; label: string; year: number }>;
  source?: string;
};

function mapMode(m: RawQuestion['mode']) {
  if (m === 'list-turns') return 'list_turns' as const;
  if (m === 'hot-potato') return 'hot_potato' as const;
  if (m === 'speed-elim') return 'speed_elim' as const;
  if (m === 'map') return 'map_mode' as const;
  return m;
}

async function loadQuestions(): Promise<RawQuestion[]> {
  const files = [
    'classic.json',
    'estimation.json',
    'list-turns.json',
    'hot-potato.json',
    'speed-elim.json',
    'map.json',
    'chronology.json',
  ];
  const out: RawQuestion[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(resolve(CONTENT_DIR, file), 'utf-8');
      const parsed = JSON.parse(raw) as RawQuestion[];
      out.push(...parsed);
    } catch (e) {
      console.warn(`Skipping missing file ${file}`);
    }
  }
  return out;
}

async function main() {
  const pack = await prisma.pack.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      slug: 'default',
      name: 'Culture G. — Pack officiel',
      description: 'Le pack par défaut du MVP, multi-modes, multi-difficultés.',
      isDefault: true,
    },
  });

  const questions = await loadQuestions();
  console.log(`Importing ${questions.length} questions...`);

  const categories = new Map<string, string>();
  for (const q of questions) {
    if (!categories.has(q.category)) {
      const slug = q.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const cat = await prisma.category.upsert({
        where: { slug },
        update: {},
        create: { slug, name: q.category },
      });
      categories.set(q.category, cat.id);
    }
  }

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {},
      create: {
        id: q.id,
        mode: mapMode(q.mode),
        difficulty: q.difficulty,
        prompt: q.prompt,
        answer: q.answer ?? null,
        aliases: q.aliases ?? [],
        numericAnswer: q.numericAnswer ?? null,
        unit: q.unit ?? null,
        validItems: q.validItems ?? [],
        turnSeconds: q.turnSeconds ?? null,
        timerSeconds: q.timerSeconds ?? null,
        bidSeconds: q.bidSeconds ?? null,
        maxBid: q.maxBid ?? null,
        targetLat: q.targetLat ?? null,
        targetLng: q.targetLng ?? null,
        targetLabel: q.targetLabel ?? null,
        maxKm: q.maxKm ?? null,
        eventsJson: q.events ? (q.events as unknown as object) : undefined,
        source: q.source ?? null,
        packId: pack.id,
        categoryId: categories.get(q.category) ?? null,
      },
    });
  }

  console.log('Seed done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

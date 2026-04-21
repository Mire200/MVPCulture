import classic from '../seed/classic.json' with { type: 'json' };
import qcm from '../seed/qcm.json' with { type: 'json' };
import estimation from '../seed/estimation.json' with { type: 'json' };
import listTurns from '../seed/list-turns.json' with { type: 'json' };
import hotPotato from '../seed/hot-potato.json' with { type: 'json' };
import speedElim from '../seed/speed-elim.json' with { type: 'json' };
import mapMode from '../seed/map.json' with { type: 'json' };
import chronology from '../seed/chronology.json' with { type: 'json' };
import imposter from '../seed/imposter.json' with { type: 'json' };
import codenames from '../seed/codenames.json' with { type: 'json' };
import wikirace from '../seed/wikirace.json' with { type: 'json' };
import wpClassic from '../seed/wikipedia-classic.json' with { type: 'json' };
import wpEstimation from '../seed/wikipedia-estimation.json' with { type: 'json' };
import wpListTurns from '../seed/wikipedia-list-turns.json' with { type: 'json' };
import wpHotPotato from '../seed/wikipedia-hot-potato.json' with { type: 'json' };
import wpSpeedElim from '../seed/wikipedia-speed-elim.json' with { type: 'json' };
import wpMap from '../seed/wikipedia-map.json' with { type: 'json' };
import wpChronology from '../seed/wikipedia-chronology.json' with { type: 'json' };
import type { Question } from '@mvpc/shared';

export const CLASSIC_QUESTIONS = [
  ...(classic as unknown as Question[]),
  ...(wpClassic as unknown as Question[]),
];
export const QCM_QUESTIONS = qcm as unknown as Question[];
export const ESTIMATION_QUESTIONS = [
  ...(estimation as unknown as Question[]),
  ...(wpEstimation as unknown as Question[]),
];
export const LIST_TURNS_QUESTIONS = [
  ...(listTurns as unknown as Question[]),
  ...(wpListTurns as unknown as Question[]),
];
export const HOT_POTATO_QUESTIONS = [
  ...(hotPotato as unknown as Question[]),
  ...(wpHotPotato as unknown as Question[]),
];
export const SPEED_ELIM_QUESTIONS = [
  ...(speedElim as unknown as Question[]),
  ...(wpSpeedElim as unknown as Question[]),
];
export const MAP_QUESTIONS = [
  ...(mapMode as unknown as Question[]),
  ...(wpMap as unknown as Question[]),
];
export const CHRONOLOGY_QUESTIONS = [
  ...(chronology as unknown as Question[]),
  ...(wpChronology as unknown as Question[]),
];
export const IMPOSTER_QUESTIONS = imposter as unknown as Question[];
export const CODENAMES_WORDS = codenames as unknown as string[];
export const WIKIRACE_QUESTIONS = wikirace as unknown as Question[];

export const ALL_QUESTIONS: Question[] = [
  ...CLASSIC_QUESTIONS,
  ...QCM_QUESTIONS,
  ...ESTIMATION_QUESTIONS,
  ...LIST_TURNS_QUESTIONS,
  ...HOT_POTATO_QUESTIONS,
  ...SPEED_ELIM_QUESTIONS,
  ...MAP_QUESTIONS,
  ...CHRONOLOGY_QUESTIONS,
];

export const ALL_CATEGORIES: string[] = Array.from(
  new Set(ALL_QUESTIONS.map((q) => q.category)),
).sort((a, b) => a.localeCompare(b, 'fr'));

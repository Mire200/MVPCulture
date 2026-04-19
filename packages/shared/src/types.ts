import { z } from 'zod';

export const GameModeIdSchema = z.enum([
  'classic',
  'estimation',
  'list-turns',
  // Prévus pour phase 2 :
  'hot-potato',
  'speed-elim',
  'map',
  'chronology',
  'guess-who',
]);
export type GameModeId = z.infer<typeof GameModeIdSchema>;

export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const AvatarSchema = z.object({
  emoji: z.string().min(1).max(4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  image: z.string().max(200).optional(),
});
export type Avatar = z.infer<typeof AvatarSchema>;

export const PlayerSchema = z.object({
  id: z.string(),
  nickname: z.string().min(1).max(20),
  avatar: AvatarSchema,
  isHost: z.boolean(),
  connected: z.boolean(),
  score: z.number().int().default(0),
  joinedAt: z.number(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const BaseQuestionSchema = z.object({
  id: z.string(),
  mode: GameModeIdSchema,
  difficulty: DifficultySchema,
  category: z.string(),
  prompt: z.string(),
  source: z.string().optional(),
});

export const ClassicQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('classic'),
  answer: z.string(),
  aliases: z.array(z.string()).default([]),
});
export type ClassicQuestion = z.infer<typeof ClassicQuestionSchema>;

export const EstimationQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('estimation'),
  numericAnswer: z.number(),
  unit: z.string().optional(),
});
export type EstimationQuestion = z.infer<typeof EstimationQuestionSchema>;

export const ListTurnsQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('list-turns'),
  validItems: z.array(z.string()).min(3),
  turnSeconds: z.number().int().min(5).max(60).default(15),
});
export type ListTurnsQuestion = z.infer<typeof ListTurnsQuestionSchema>;

export const HotPotatoQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('hot-potato'),
  validItems: z.array(z.string()).min(3),
  bidSeconds: z.number().int().min(5).max(30).default(10),
  answerSeconds: z.number().int().min(15).max(90).default(30),
  maxBid: z.number().int().min(3).max(30).default(10),
});
export type HotPotatoQuestion = z.infer<typeof HotPotatoQuestionSchema>;

export const SpeedElimQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('speed-elim'),
  answer: z.string(),
  aliases: z.array(z.string()).default([]),
  timerSeconds: z.number().int().min(5).max(20).default(10),
});
export type SpeedElimQuestion = z.infer<typeof SpeedElimQuestionSchema>;

export const MapQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('map'),
  targetLat: z.number().min(-90).max(90),
  targetLng: z.number().min(-180).max(180),
  targetLabel: z.string(),
  maxKm: z.number().positive().default(3000),
});
export type MapQuestion = z.infer<typeof MapQuestionSchema>;

export const ChronologyEventSchema = z.object({
  id: z.string(),
  label: z.string(),
  year: z.number().int(),
});
export type ChronologyEvent = z.infer<typeof ChronologyEventSchema>;

export const ChronologyQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('chronology'),
  events: z.array(ChronologyEventSchema).min(3).max(8),
});
export type ChronologyQuestion = z.infer<typeof ChronologyQuestionSchema>;

export const GuessWhoQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('guess-who'),
});
export type GuessWhoQuestion = z.infer<typeof GuessWhoQuestionSchema>;

export const QuestionSchema = z.discriminatedUnion('mode', [
  ClassicQuestionSchema,
  EstimationQuestionSchema,
  ListTurnsQuestionSchema,
  HotPotatoQuestionSchema,
  SpeedElimQuestionSchema,
  MapQuestionSchema,
  ChronologyQuestionSchema,
  GuessWhoQuestionSchema,
]);
export type Question = z.infer<typeof QuestionSchema>;

export const RoomPhaseSchema = z.enum([
  'lobby',
  'round_prepare',
  'round_ask',
  'round_collect',
  'round_reveal',
  'round_validate',
  'round_score',
  'match_final',
]);
export type RoomPhase = z.infer<typeof RoomPhaseSchema>;

export const GameConfigSchema = z.object({
  rounds: z.number().int().min(1).max(30).default(8),
  modesPool: z.array(GameModeIdSchema).default(['classic', 'estimation', 'list-turns']),
  difficulty: z.enum(['mixed', 'easy', 'medium', 'hard']).default('mixed'),
  answerTimeSeconds: z.number().int().min(10).max(180).default(30),
  categoriesPool: z.array(z.string()).default([]),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

export interface RoundStateBase {
  roundIndex: number;
  question: PublicQuestion;
  mode: GameModeId;
  phase: RoomPhase;
  endsAt?: number;
  currentPlayerId?: string;
  hpPhase?: 'bid' | 'answer';
  hpProgress?: Record<string, { bid?: number; count: number; done: boolean }>;
  gwPhase?: 'select' | 'play';
  gwSecrets?: Record<string, boolean>;
  gwEliminated?: string[];
  gwRevealed?: Record<string, string>;
  gwCurrentGrid?: string[];
  gwWinnerId?: string;
}

export interface PublicQuestion {
  id: string;
  mode: GameModeId;
  difficulty: Difficulty;
  category: string;
  prompt: string;
  unit?: string;
  turnSeconds?: number;
  bidSeconds?: number;
  maxBid?: number;
  timerSeconds?: number;
  mapHint?: { centerLat?: number; centerLng?: number; zoom?: number };
  events?: Array<{ id: string; label: string }>;
}

export interface PlayerAnswer {
  playerId: string;
  mode: GameModeId;
  text?: string;
  numeric?: number;
  listItems?: string[];
  bid?: number;
  lat?: number;
  lng?: number;
  order?: string[];
  submittedAt: number;
}

export interface HostValidation {
  playerId: string;
  correct: boolean;
}

export interface RoundReveal {
  roundIndex: number;
  question: Question;
  answers: Array<{
    playerId: string;
    text?: string;
    numeric?: number;
    listItems?: string[];
    bid?: number;
    success?: boolean;
    lat?: number;
    lng?: number;
    distanceKm?: number;
    order?: string[];
    answeredAt?: number;
    speedRank?: number;
  }>;
  autoValidations: Record<string, boolean>;
  eliminationOrder?: string[];
}

export interface RoundScoring {
  roundIndex: number;
  deltas: Record<string, number>;
  totals: Record<string, number>;
  officialAnswer: string;
}

/** Palette de stylos du lobby — une couleur stable par joueur (ordre d’arrivée). */
export const LOBBY_PEN_PALETTE: readonly string[] = [
  '#22d3ee',
  '#a855f7',
  '#a3e635',
  '#f43f5e',
  '#fbbf24',
  '#ec4899',
  '#3b82f6',
  '#10b981',
  '#f97316',
  '#e879f9',
  '#14b8a6',
  '#eab308',
];

/** Couleur de stylo affichée / serveur pour un joueur (tri par `joinedAt`). */
export function lobbyPenColorForPlayer(players: Player[], playerId: string | null): string {
  if (!playerId || players.length === 0) return LOBBY_PEN_PALETTE[0]!;
  const sorted = [...players].sort((a, b) => a.joinedAt - b.joinedAt);
  const idx = sorted.findIndex((p) => p.id === playerId);
  const i = idx >= 0 ? idx : 0;
  return LOBBY_PEN_PALETTE[i % LOBBY_PEN_PALETTE.length]!;
}

/** Trait de dessin du lobby (coordonnées normalisées 0–1 dans le cadre du canevas). */
export interface LobbyDrawStroke {
  id: string;
  playerId: string;
  color: string;
  /** Épaisseur relative (fraction de la plus petite dimension du canevas). */
  widthNorm: number;
  points: [number, number][];
}

export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  players: Player[];
  hostId: string;
  config: GameConfig;
  round?: RoundStateBase;
  roundIndex: number;
  totalRounds: number;
  createdAt: number;
}

export const ROOM_CODE_LENGTH = 5;
export const MAX_PLAYERS_PER_ROOM = 12;

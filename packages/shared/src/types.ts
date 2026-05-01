import { z } from 'zod';
import { TTR_MAP_IDS, type TtrMapId } from './ticketToRideMap.js';

export const GameModeIdSchema = z.enum([
  'classic',
  'qcm',
  'estimation',
  'list-turns',
  // Prévus pour phase 2 :
  'hot-potato',
  'speed-elim',
  'map',
  'chronology',
  'guess-who',
  'imposter',
  'codenames',
  'wikirace',
  'gartic-phone',
  'bombparty',
  'ticket-to-ride',
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

/** Équipe de Codenames. Choisi dans le lobby, non modifiable en cours de partie. */
export const CodenamesTeamSchema = z.enum(['red', 'blue', 'spectator']);
export type CodenamesTeam = z.infer<typeof CodenamesTeamSchema>;

export const PlayerSchema = z.object({
  id: z.string(),
  nickname: z.string().min(1).max(20),
  avatar: AvatarSchema,
  isHost: z.boolean(),
  connected: z.boolean(),
  score: z.number().int().default(0),
  joinedAt: z.number(),
  /** Équipe choisie pour Codenames (uniquement dans le lobby). */
  cnTeam: CodenamesTeamSchema.optional(),
  /** Le joueur se propose comme spymaster (uniquement Codenames / lobby). */
  cnWantsSpymaster: z.boolean().optional(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const BaseQuestionSchema = z.object({
  id: z.string(),
  mode: GameModeIdSchema,
  difficulty: DifficultySchema,
  category: z.string(),
  prompt: z.string(),
  source: z.string().optional(),
  tags: z.array(z.string()).default([]).optional(),
});

export const ClassicQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('classic'),
  answer: z.string(),
  aliases: z.array(z.string()).default([]),
});
export type ClassicQuestion = z.infer<typeof ClassicQuestionSchema>;

/**
 * QCM : question à choix multiples. L'auteur donne `answer` (la bonne réponse
 * canonique) et `distractors` (les mauvaises propositions). Le backend
 * construit la liste finale `choices` en mélangeant le tout de façon
 * déterministe par manche, et expose `choices` dans la `PublicQuestion`.
 */
export const QcmQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('qcm'),
  answer: z.string().min(1),
  distractors: z.array(z.string().min(1)).min(1).max(6),
});
export type QcmQuestion = z.infer<typeof QcmQuestionSchema>;

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

export const ImposterQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('imposter'),
  civilianWord: z.string().min(1),
  imposterWord: z.string().min(1),
  aliases: z.array(z.string()).default([]),
});
export type ImposterQuestion = z.infer<typeof ImposterQuestionSchema>;

export const CodenamesQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('codenames'),
});
export type CodenamesQuestion = z.infer<typeof CodenamesQuestionSchema>;

export const WikiraceQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('wikirace'),
  startTitle: z.string().min(1).max(120),
  targetTitle: z.string().min(1).max(120),
  wikiLang: z.string().min(2).max(5).default('fr'),
});
export type WikiraceQuestion = z.infer<typeof WikiraceQuestionSchema>;

export const GarticPhoneQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('gartic-phone'),
});
export type GarticPhoneQuestion = z.infer<typeof GarticPhoneQuestionSchema>;

export const BombpartyQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('bombparty'),
  initialLives: z.number().int().min(1).max(5).default(3),
});
export type BombpartyQuestion = z.infer<typeof BombpartyQuestionSchema>;

export const TicketToRideQuestionSchema = BaseQuestionSchema.extend({
  mode: z.literal('ticket-to-ride'),
  // Optionnel : si on veut des questions custom pour chaque tronçon, ou utiliser le pool global.
  // Pour l'MVP, on pioche des questions globales ou on définit une série de questions.
});
export type TicketToRideQuestion = z.infer<typeof TicketToRideQuestionSchema>;

export const QuestionSchema = z.discriminatedUnion('mode', [
  ClassicQuestionSchema,
  QcmQuestionSchema,
  EstimationQuestionSchema,
  ListTurnsQuestionSchema,
  HotPotatoQuestionSchema,
  SpeedElimQuestionSchema,
  MapQuestionSchema,
  ChronologyQuestionSchema,
  GuessWhoQuestionSchema,
  ImposterQuestionSchema,
  CodenamesQuestionSchema,
  WikiraceQuestionSchema,
  GarticPhoneQuestionSchema,
  BombpartyQuestionSchema,
  TicketToRideQuestionSchema,
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
  /** Carte choisie pour le mode Aventuriers du Rail. */
  ttrMapId: z.enum(TTR_MAP_IDS).default('france'),
});
export type GameConfig = z.infer<typeof GameConfigSchema>;

export interface RoundStateBase {
  roundIndex: number;
  question: PublicQuestion;
  mode: GameModeId;
  phase: RoomPhase;
  endsAt?: number;
  currentPlayerId?: string;
  /** Ordre des tours pour le mode `list-turns` (tous les joueurs, vivants + éliminés). */
  turnOrder?: string[];
  /** IDs éliminés dans l'ordre pour le mode `list-turns`. */
  turnEliminated?: string[];
  hpPhase?: 'bid' | 'answer';
  hpProgress?: Record<string, { bid?: number; count: number; done: boolean }>;
  gwPhase?: 'select' | 'play';
  gwSecrets?: Record<string, boolean>;
  gwEliminated?: string[];
  gwRevealed?: Record<string, string>;
  gwCurrentGrid?: string[];
  /**
   * Historique public des guesses du round, révélé **uniquement à la fin de
   * chaque tour** : les tentatives du tour courant restent privées (seul le
   * guesser connaît son propre résultat via l'ack) pour ne pas influencer les
   * autres joueurs qui voudraient eux aussi tenter. Au flush :
   * - les guesses corrects éliminent leur cible (et révèlent son avatar)
   * - les guesses ratés n'ont aucun effet hors de la grille correspondante
   *   (le guesser peut encore tenter sur les autres grilles).
   */
  gwGuesses?: Array<{ playerId: string; targetId: string; avatarSrc: string; correct: boolean }>;
  /** Sous-phase du mode imposteur. */
  imPhase?: 'clue-1' | 'clue-2' | 'vote' | 'guess' | 'done';
  /** Indices soumis par tour, par joueur. `[tour0, tour1]`. */
  imClues?: Array<Record<string, string>>;
  /** IDs des joueurs ayant voté (cibles masquées jusqu'à la révélation). */
  imVoters?: string[];
  /** Révélé uniquement au reveal : id de l'imposteur. */
  imImposterId?: string;
  /** Révélé uniquement au reveal : imposteur démasqué ? */
  imDemasque?: boolean;
  /** Révélé uniquement au reveal : devinette de l'imposteur (si applicable). */
  imGuess?: string;
  /** Révélé uniquement au reveal : devinette correcte ? */
  imGuessCorrect?: boolean;
  /** Révélé uniquement au reveal : tally des votes `{targetId: count}`. */
  imVoteTally?: Record<string, number>;

  /** Sous-phase Codenames. */
  cnPhase?: 'clue' | 'guess' | 'done';
  /** Grille 5x5. `color` n'est renseigné que sur les tuiles révélées publiquement. */
  cnGrid?: Array<{ word: string; color?: 'red' | 'blue' | 'neutral' | 'assassin' }>;
  /** Équipe active (celle qui doit donner l'indice ou deviner). */
  cnCurrentTeam?: 'red' | 'blue';
  /** IDs des spymasters des deux équipes. */
  cnSpymasters?: { red: string; blue: string };
  /** Indice courant en cours de phase guess. */
  cnClue?: { word: string; count: number; byTeam: 'red' | 'blue' };
  /** Tentatives restantes dans la phase guess courante. */
  cnGuessesLeft?: number;
  /** Nombre de mots encore à trouver par équipe. */
  cnRemaining?: { red: number; blue: number };
  /** Gagnant final (rempli quand `cnPhase === 'done'`). */
  cnWinner?: 'red' | 'blue';
  /** Raison de la fin de partie. */
  cnEndReason?: 'assassin' | 'allFound' | 'forfeit';
  /** Historique des indices donnés, par ordre chronologique. */
  cnClueHistory?: Array<{ word: string; count: number; byTeam: 'red' | 'blue' }>;

  /** Speed-elim : nombre de joueurs à devoir trouver pour clore la manche. */
  seTargetFinders?: number;
  /** Speed-elim : IDs des joueurs ayant trouvé, dans l'ordre d'arrivée. */
  seFinders?: string[];
  /** Speed-elim : nombre total de tentatives envoyées par joueur (pour l'UI). */
  seAttemptCount?: Record<string, number>;

  /** Wikirace : titre de départ (identique pour tout le monde). */
  wrStartTitle?: string;
  /** Wikirace : titre cible à atteindre. */
  wrTargetTitle?: string;
  /** Wikirace : langue Wikipédia utilisée (`fr`, `en`, …). */
  wrWikiLang?: string;
  /** Wikirace : timestamp du départ de la course. */
  wrStartedAt?: number;
  /**
   * Wikirace : état public par joueur durant la course. Le chemin détaillé
   * reste privé jusqu'au reveal ; on n'expose que le nombre de sauts, le
   * statut et le timestamp d'arrivée éventuel.
   */
  wrPlayers?: Record<
    string,
    {
      status: 'running' | 'finished' | 'abandoned' | 'disconnected';
      hops: number;
      finishedAt?: number;
    }
  >;

  /** Gartic Phone : sous-phase courante. */
  gpPhase?: 'write' | 'draw' | 'guess' | 'reveal' | 'done';
  /** Gartic Phone : index de l'étape courante (0 = write, 1 = draw, …). */
  gpStepIndex?: number;
  /** Gartic Phone : nombre total d'étapes. */
  gpTotalSteps?: number;
  /** Gartic Phone : ordre circulaire des joueurs. */
  gpPlayerOrder?: string[];
  /** Gartic Phone : IDs des joueurs ayant soumis cette étape. */
  gpSubmitted?: string[];
  /** Gartic Phone : index de la chaîne en cours de reveal. */
  gpRevealChainIndex?: number;
  /** Gartic Phone : index de l'étape courante dans la chaîne en cours de reveal. */
  gpRevealStepIndex?: number;
  /** Gartic Phone : la chaîne complète (jusqu'à l'étape courante) pour l'UI. */
  gpRevealChain?: Array<{ type: 'text' | 'drawing'; playerId: string; content: string }>;

  /** Bombparty : joueur dont c'est le tour. */
  bpCurrentPlayerId?: string;
  /** Bombparty : timer restant estimé (en ms) pour la bombe. */
  bpTimerMs?: number;
  /** Bombparty : timestamp cible où la bombe explose. */
  bpExplodesAt?: number;
  /** Bombparty : syllabe obligatoire. */
  bpSyllable?: string;
  /** Bombparty : nombre de vies restantes par joueur. */
  bpLives?: Record<string, number>;
  /** Bombparty : tableau des 26 lettres validées par le joueur (pour UI alphabet). */
  bpAlphabets?: Record<string, string[]>;

  /** Ticket to Ride : sous-phase du jeu. */
  ttrSub?: 'initial-destinations' | 'playing' | 'last-round' | 'done';
  /** Ticket to Ride : carte jouée. */
  ttrMapId?: TtrMapId;
  /** Ticket to Ride : ordre des joueurs. */
  ttrTurnOrder?: string[];
  /** Ticket to Ride : joueur dont c'est le tour. */
  ttrCurrentPlayerId?: string;
  /** Ticket to Ride : deadline du tour courant. */
  ttrTurnEndsAt?: number;
  /** Ticket to Ride : marché 5 cartes face visible (null = pioche vide). */
  ttrMarket?: Array<string | null>;
  /** Ticket to Ride : taille de la pioche wagons. */
  ttrDeckSize?: number;
  /** Ticket to Ride : taille de la défausse wagons. */
  ttrDiscardSize?: number;
  /** Ticket to Ride : taille de la pioche de billets destination restants. */
  ttrDestinationDeckSize?: number;
  /** Ticket to Ride : nombre de wagons restants par joueur. */
  ttrTrains?: Record<string, number>;
  /** Ticket to Ride : nombre de cartes en main par joueur (public, pas les couleurs). */
  ttrHandCounts?: Record<string, number>;
  /** Ticket to Ride : nombre de billets destination détenus par joueur (public). */
  ttrDestinationCounts?: Record<string, number>;
  /** Ticket to Ride : routes capturées (id, ownerId, couleur payée). */
  ttrClaimedRoutes?: Array<{ id: string; ownerId?: string; paidColor?: string }>;
  /** Ticket to Ride : score partiel (tronçons uniquement). */
  ttrScoreFromRoutes?: Record<string, number>;
  /** Ticket to Ride : joueur qui a déclenché le dernier tour. */
  ttrLastRoundTriggerId?: string;
  /** Ticket to Ride : action en cours pour le joueur actif. */
  ttrTurnAction?:
    | { kind: 'idle' }
    | { kind: 'drew-one'; tookLoco: boolean }
    | { kind: 'picking-destinations'; minKeep: number };
  /** Ticket to Ride : pour la phase initial-destinations, quels joueurs ont confirmé. */
  ttrInitialConfirmed?: Record<string, boolean>;
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
  /** Choix publics pour le mode QCM (ordre déjà mélangé côté serveur). */
  choices?: string[];
  /** Wikirace : page de départ. */
  wrStartTitle?: string;
  /** Wikirace : page cible à atteindre. */
  wrTargetTitle?: string;
  /** Wikirace : code langue Wikipédia. */
  wrWikiLang?: string;
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

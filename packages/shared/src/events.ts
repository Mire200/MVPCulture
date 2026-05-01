import { z } from 'zod';
import {
  AvatarSchema,
  CodenamesTeamSchema,
  GameConfigSchema,
  type HostValidation,
  type LobbyDrawStroke,
  type Player,
  type RoomSnapshot,
  type RoundReveal,
  type RoundScoring,
} from './types.js';
import type { RadioStatePayload } from './radio.js';
import type { TvStatePayload } from './tv.js';

export const CreateRoomPayloadSchema = z.object({
  nickname: z.string().trim().min(1).max(20),
  avatar: AvatarSchema,
  playerId: z.string().optional(),
});
export type CreateRoomPayload = z.infer<typeof CreateRoomPayloadSchema>;

export const JoinRoomPayloadSchema = z.object({
  code: z.string().trim().toUpperCase().length(5),
  nickname: z.string().trim().min(1).max(20),
  avatar: AvatarSchema,
  playerId: z.string().optional(),
  hostToken: z.string().optional(),
});
export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;

export const StartGamePayloadSchema = z.object({
  config: GameConfigSchema.partial().optional(),
});
export type StartGamePayload = z.infer<typeof StartGamePayloadSchema>;

/**
 * L'hôte met à jour la config du lobby en temps réel. Utile pour que les
 * non-hôtes voient les changements de modes / manches / catégories
 * (notamment pour afficher le panel d'équipes Codenames).
 */
export const SetLobbyConfigPayloadSchema = z.object({
  config: GameConfigSchema.partial(),
});
export type SetLobbyConfigPayload = z.infer<typeof SetLobbyConfigPayloadSchema>;

export const AnswerPayloadSchema = z.object({
  text: z.string().trim().max(200).optional(),
  numeric: z.number().finite().optional(),
  listItem: z.string().trim().max(80).optional(),
  bid: z.number().int().min(1).max(50).optional(),
  listItems: z.array(z.string().trim().max(80)).max(50).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  order: z.array(z.string()).max(10).optional(),
});
export type AnswerPayload = z.infer<typeof AnswerPayloadSchema>;

export const ValidatePayloadSchema = z.object({
  validations: z.array(
    z.object({
      playerId: z.string(),
      correct: z.boolean(),
    }),
  ),
});
export type ValidatePayload = z.infer<typeof ValidatePayloadSchema>;

export const GuessWhoPickSecretPayloadSchema = z.object({
  avatarSrc: z.string().min(1).max(200),
});
export type GuessWhoPickSecretPayload = z.infer<typeof GuessWhoPickSecretPayloadSchema>;

export const GuessWhoToggleMaskPayloadSchema = z.object({
  targetId: z.string().min(1).max(50),
  avatarSrc: z.string().min(1).max(200),
  masked: z.boolean(),
});
export type GuessWhoToggleMaskPayload = z.infer<typeof GuessWhoToggleMaskPayloadSchema>;

export const GuessWhoGuessPayloadSchema = z.object({
  avatarSrc: z.string().min(1).max(200),
});
export type GuessWhoGuessPayload = z.infer<typeof GuessWhoGuessPayloadSchema>;

export const ImposterSubmitCluePayloadSchema = z.object({
  clue: z.string().trim().min(1).max(40),
});
export type ImposterSubmitCluePayload = z.infer<typeof ImposterSubmitCluePayloadSchema>;

export const ImposterVotePayloadSchema = z.object({
  targetId: z.string().min(1).max(50),
});
export type ImposterVotePayload = z.infer<typeof ImposterVotePayloadSchema>;

export const ImposterGuessPayloadSchema = z.object({
  guess: z.string().trim().min(1).max(60),
});
export type ImposterGuessPayload = z.infer<typeof ImposterGuessPayloadSchema>;

/**
 * Mot privé envoyé à chaque joueur. On n'expose JAMAIS au client s'il est
 * l'imposteur : il joue "à l'aveugle" et ne le découvre qu'au vote final
 * (s'il est démasqué) ou à la révélation.
 */
export type ImposterYourWordPayload = {
  word: string;
};

export const CodenamesSetTeamPayloadSchema = z.object({
  team: CodenamesTeamSchema,
});
export type CodenamesSetTeamPayload = z.infer<typeof CodenamesSetTeamPayloadSchema>;

export const CodenamesSetSpymasterPayloadSchema = z.object({
  wants: z.boolean(),
});
export type CodenamesSetSpymasterPayload = z.infer<typeof CodenamesSetSpymasterPayloadSchema>;

export const CodenamesSubmitCluePayloadSchema = z.object({
  word: z.string().trim().min(1).max(40),
  count: z.number().int().min(0).max(9),
});
export type CodenamesSubmitCluePayload = z.infer<typeof CodenamesSubmitCluePayloadSchema>;

export const CodenamesGuessTilePayloadSchema = z.object({
  index: z.number().int().min(0).max(24),
});
export type CodenamesGuessTilePayload = z.infer<typeof CodenamesGuessTilePayloadSchema>;

/** Clé privée envoyée au spymaster : 25 couleurs, une par tuile. */
export type CodenamesKeyPayload = {
  key: Array<'red' | 'blue' | 'neutral' | 'assassin'>;
};

export const WikiraceNavigatePayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
});
export type WikiraceNavigatePayload = z.infer<typeof WikiraceNavigatePayloadSchema>;

export const GarticPhoneSubmitTextPayloadSchema = z.object({
  text: z.string().trim().min(1).max(200),
});
export type GarticPhoneSubmitTextPayload = z.infer<typeof GarticPhoneSubmitTextPayloadSchema>;

export const GarticPhoneSubmitDrawingPayloadSchema = z.object({
  dataUrl: z.string().min(1).max(200_000),
});
export type GarticPhoneSubmitDrawingPayload = z.infer<typeof GarticPhoneSubmitDrawingPayloadSchema>;

export const GarticPhoneAdvanceRevealPayloadSchema = z.object({});
export type GarticPhoneAdvanceRevealPayload = z.infer<typeof GarticPhoneAdvanceRevealPayloadSchema>;

export type GarticPhonePromptPayload = {
  type: 'text' | 'drawing';
  content: string;
};

export type GarticPhoneRevealPayload = {
  chainOwnerId: string;
  entries: Array<{ type: 'text' | 'drawing'; playerId: string; content: string }>;
};

export const BombpartySubmitWordPayloadSchema = z.object({
  word: z.string().trim().min(1).max(50),
});
export type BombpartySubmitWordPayload = z.infer<typeof BombpartySubmitWordPayloadSchema>;

/**
 * Le joueur actif diffuse en continu son input partiel pour que les autres
 * voient en direct ce qu'il est en train de taper (effet « live caption »).
 * Aucun ack — c'est un canal best-effort, throttlé côté client.
 */
export const BombpartyTypingPayloadSchema = z.object({
  partial: z.string().max(50),
});
export type BombpartyTypingPayload = z.infer<typeof BombpartyTypingPayloadSchema>;

/** Diffusé par le serveur à toute la room avec l'auteur du tapotement. */
export type BombpartyTypingBroadcastPayload = {
  playerId: string;
  partial: string;
};

export const TicketToRideDrawFromMarketPayloadSchema = z.object({
  /** Index de l'emplacement 0..4 du marché. */
  slot: z.number().int().min(0).max(4),
});
export type TicketToRideDrawFromMarketPayload = z.infer<
  typeof TicketToRideDrawFromMarketPayloadSchema
>;

export const TicketToRideClaimRoutePayloadSchema = z.object({
  routeId: z.string().min(1),
  /** Couleur de cartes dépensée (obligatoire, sauf loco pur qui paye 'loco'). */
  paidColor: z.string().min(1).max(10),
  /** Nombre de locomotives utilisées dans le paiement. */
  locoCount: z.number().int().min(0).max(6),
});
export type TicketToRideClaimRoutePayload = z.infer<typeof TicketToRideClaimRoutePayloadSchema>;

export const TicketToRideKeepDestinationsPayloadSchema = z.object({
  /** Billets conservés parmi ceux piochés. */
  kept: z.array(z.string().min(1)).min(1).max(3),
});
export type TicketToRideKeepDestinationsPayload = z.infer<
  typeof TicketToRideKeepDestinationsPayloadSchema
>;

export type TicketToRidePrivatePayload = {
  hand: Record<string, number>;
  destinations: string[];
  pendingDraw?: string[];
  pendingIsInitial?: boolean;
};

export const LobbyDrawStrokePayloadSchema = z.object({
  widthNorm: z.number().min(0.004).max(0.12),
  points: z
    .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]))
    .min(2)
    .max(6000),
});
export type LobbyDrawStrokePayload = z.infer<typeof LobbyDrawStrokePayloadSchema>;

export type ClientToServerEvents = {
  'room:create': (payload: CreateRoomPayload, ack: (res: AckResult<CreateRoomResult>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: AckResult<JoinRoomResult>) => void) => void;
  'room:leave': () => void;
  'room:resume': (
    payload: { code: string; playerId: string; hostToken?: string },
    ack: (res: AckResult<JoinRoomResult>) => void,
  ) => void;
  'game:start': (payload: StartGamePayload, ack: (res: AckResult<null>) => void) => void;
  'lobby:setConfig': (
    payload: SetLobbyConfigPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'round:answer': (
    payload: AnswerPayload,
    ack: (res: AckResult<{ correct?: boolean } | null>) => void,
  ) => void;
  'round:validate': (payload: ValidatePayload, ack: (res: AckResult<null>) => void) => void;
  'round:advance': (ack: (res: AckResult<null>) => void) => void;
  'match:rematch': (ack: (res: AckResult<null>) => void) => void;
  /**
   * Relance immédiatement une nouvelle partie avec la même config, sans
   * repasser par le lobby. Réservé aux modes à 1 partie = 1 match
   * (qui-est-ce / imposter / codenames).
   */
  'match:replay': (ack: (res: AckResult<null>) => void) => void;
  'guessWho:pickSecret': (
    payload: GuessWhoPickSecretPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'guessWho:toggleMask': (
    payload: GuessWhoToggleMaskPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'guessWho:nextTurn': (ack: (res: AckResult<null>) => void) => void;
  'guessWho:selfEliminate': (ack: (res: AckResult<null>) => void) => void;
  'guessWho:guess': (
    payload: GuessWhoGuessPayload,
    ack: (res: AckResult<{ correct: boolean }>) => void,
  ) => void;
  'imposter:submitClue': (
    payload: ImposterSubmitCluePayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'imposter:vote': (
    payload: ImposterVotePayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'imposter:guessWord': (
    payload: ImposterGuessPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'lobby:codenames:setTeam': (
    payload: CodenamesSetTeamPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'lobby:codenames:setSpymaster': (
    payload: CodenamesSetSpymasterPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'codenames:submitClue': (
    payload: CodenamesSubmitCluePayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'codenames:guessTile': (
    payload: CodenamesGuessTilePayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'codenames:endTurn': (ack: (res: AckResult<null>) => void) => void;
  'wikirace:navigate': (
    payload: WikiraceNavigatePayload,
    ack: (res: AckResult<{ finished: boolean; hops: number }>) => void,
  ) => void;
  'wikirace:abandon': (ack: (res: AckResult<null>) => void) => void;
  'garticPhone:submitText': (
    payload: GarticPhoneSubmitTextPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'garticPhone:submitDrawing': (
    payload: GarticPhoneSubmitDrawingPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'garticPhone:advanceReveal': (
    payload: GarticPhoneAdvanceRevealPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'bombparty:submitWord': (
    payload: BombpartySubmitWordPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  /** Best-effort, sans ack : le joueur actif diffuse son input partiel. */
  'bombparty:typing': (payload: BombpartyTypingPayload) => void;
  'ttr:confirmInitialDestinations': (
    payload: TicketToRideKeepDestinationsPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'ttr:drawFromDeck': (ack: (res: AckResult<null>) => void) => void;
  'ttr:drawFromMarket': (
    payload: TicketToRideDrawFromMarketPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'ttr:claimRoute': (
    payload: TicketToRideClaimRoutePayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'ttr:drawDestinations': (ack: (res: AckResult<null>) => void) => void;
  'ttr:keepDestinations': (
    payload: TicketToRideKeepDestinationsPayload,
    ack: (res: AckResult<null>) => void,
  ) => void;
  'radio:sync': (ack: (res: AckResult<RadioStatePayload>) => void) => void;
  'radio:skip': (ack: (res: AckResult<RadioStatePayload>) => void) => void;
  'tv:sync': (ack: (res: AckResult<TvStatePayload>) => void) => void;
  'tv:skip': (ack: (res: AckResult<TvStatePayload>) => void) => void;
  'lobby:draw:stroke': (payload: LobbyDrawStrokePayload, ack: (res: AckResult<null>) => void) => void;
  'lobby:draw:clear': (ack: (res: AckResult<null>) => void) => void;
  'lobby:drawing:request': (ack: (res: AckResult<{ strokes: LobbyDrawStroke[] }>) => void) => void;
};

export type ServerToClientEvents = {
  'room:state': (snapshot: RoomSnapshot) => void;
  'room:player_joined': (player: Player) => void;
  'room:player_left': (playerId: string) => void;
  'round:started': (snapshot: RoomSnapshot) => void;
  'round:tick': (payload: { endsAt: number; currentPlayerId?: string }) => void;
  'round:player_answered': (payload: { playerId: string }) => void;
  'round:eliminated': (payload: { playerId: string; reason: 'duplicate' | 'invalid' | 'timeout' }) => void;
  'round:turn_started': (payload: { currentPlayerId: string; endsAt: number }) => void;
  'round:reveal': (reveal: RoundReveal) => void;
  'round:validated': (payload: { validations: HostValidation[] }) => void;
  'round:scored': (scoring: RoundScoring) => void;
  'match:final': (payload: { standings: Player[] }) => void;
  'error': (payload: { code: string; message: string }) => void;
  'guessWho:masks': (payload: { byTarget: Record<string, string[]> }) => void;
  'guessWho:playerEliminated': (payload: { playerId: string; revealedAvatar: string }) => void;
  'imposter:yourWord': (payload: ImposterYourWordPayload) => void;
  'imposter:clueSubmitted': (payload: { playerId: string }) => void;
  'imposter:voted': (payload: { playerId: string }) => void;
  'codenames:key': (payload: CodenamesKeyPayload) => void;
  'radio:state': (state: RadioStatePayload) => void;
  'tv:state': (state: TvStatePayload) => void;
  'lobby:draw:stroke': (stroke: LobbyDrawStroke) => void;
  'lobby:draw:cleared': () => void;
  'lobby:drawing:sync': (payload: { strokes: LobbyDrawStroke[] }) => void;
  'garticPhone:prompt': (payload: GarticPhonePromptPayload) => void;
  'garticPhone:reveal': (payload: GarticPhoneRevealPayload) => void;
  'ttr:private': (payload: TicketToRidePrivatePayload) => void;
  /** Live partial typing du joueur actif Bombparty. */
  'bombparty:typing': (payload: BombpartyTypingBroadcastPayload) => void;
};

export type AckResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export type CreateRoomResult = {
  code: string;
  playerId: string;
  hostToken: string;
  snapshot: RoomSnapshot;
};

export type JoinRoomResult = {
  code: string;
  playerId: string;
  hostToken?: string;
  snapshot: RoomSnapshot;
};

export const ERROR_CODES = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_ALREADY_STARTED: 'ROOM_ALREADY_STARTED',
  NOT_HOST: 'NOT_HOST',
  NOT_IN_ROOM: 'NOT_IN_ROOM',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  RATE_LIMITED: 'RATE_LIMITED',
  PHASE_MISMATCH: 'PHASE_MISMATCH',
  NOT_YOUR_TURN: 'NOT_YOUR_TURN',
  ALREADY_ANSWERED: 'ALREADY_ANSWERED',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

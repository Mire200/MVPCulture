import type {
  AnswerPayload,
  GameModeId,
  HostValidation,
  Player,
  PublicQuestion,
  Question,
  RoundReveal,
  RoundScoring,
} from '@mvpc/shared';

export interface GameModeContext {
  players: Player[];
  question: Question;
  roundIndex: number;
  now: () => number;
}

/**
 * Réponse d'un joueur, normalisée par le mode.
 */
export interface CollectedAnswer {
  playerId: string;
  raw: AnswerPayload;
  submittedAt: number;
}

export interface TurnState {
  currentPlayerId: string;
  endsAt: number;
  eliminatedOrder: string[];
  usedItems: string[];
  correctContributions: Record<string, number>;
  /**
   * Vrai quand on joue l'ultime tour du dernier survivant parce que personne
   * n'a encore trouvé de bonne réponse. Après cet ultime tour, la manche se
   * termine quoi qu'il arrive.
   */
  finalLast?: boolean;
}

export interface HotPotatoPlayerState {
  bid?: number;
  items: string[]; // normalisés
  done: boolean;
  startedAt?: number;
  endsAt?: number;
}

export interface HotPotatoState {
  phase: 'bid' | 'answer' | 'done';
  bidEndsAt: number;
  answerEndsAt?: number;
  players: Record<string, HotPotatoPlayerState>;
  usedByPlayer: Record<string, Set<string>>;
}

export type CollectPhase =
  | { kind: 'parallel'; answers: Map<string, CollectedAnswer>; endsAt: number }
  | { kind: 'turns'; turn: TurnState }
  | { kind: 'hot-potato'; hp: HotPotatoState };

export interface RoundState {
  roundIndex: number;
  question: Question;
  publicQuestion: PublicQuestion;
  mode: GameModeId;
  collect: CollectPhase;
  autoValidations: Record<string, boolean>;
  hostValidations: Record<string, boolean>;
  revealed: boolean;
  scoring?: RoundScoring;
  reveal?: RoundReveal;
}

export interface GameMode {
  readonly id: GameModeId;
  prepare(ctx: GameModeContext, defaultSeconds: number): RoundState;
  acceptAnswer(
    state: RoundState,
    playerId: string,
    payload: AnswerPayload,
  ): AcceptAnswerResult;
  isCollectComplete(state: RoundState, activePlayers: Player[]): boolean;
  buildReveal(state: RoundState, players: Player[]): RoundReveal;
  computeScores(
    state: RoundState,
    players: Player[],
    hostValidations?: HostValidation[],
  ): RoundScoring;
}

export type AcceptAnswerResult =
  | { ok: true; roundState: RoundState; events: RoundEvent[] }
  | { ok: false; code: string; message: string };

export type RoundEvent =
  | { type: 'player_answered'; playerId: string }
  | { type: 'eliminated'; playerId: string; reason: 'duplicate' | 'invalid' | 'timeout' }
  | { type: 'turn_started'; currentPlayerId: string; endsAt: number }
  | { type: 'hp_bid_placed'; playerId: string; bid: number }
  | { type: 'hp_answer_phase_started'; endsAt: number }
  | { type: 'hp_item_accepted'; playerId: string; item: string; count: number }
  | { type: 'hp_item_rejected'; playerId: string; reason: 'duplicate' | 'invalid' }
  | { type: 'hp_player_done'; playerId: string; success: boolean };

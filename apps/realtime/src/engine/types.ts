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
  /** Ordre de passage initial figé au prepare (joueurs vivants + déjà passés). */
  order: string[];
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

export interface GuessWhoState {
  sub: 'select' | 'play';
  turnOrder: string[];
  currentTargetIndex: number;
  secrets: Map<string, string>;
  grids: Map<string, string[]>;
  masks: Map<string, Set<string>>;
  eliminated: Set<string>;
  revealed: Map<string, string>;
  /**
   * Guesses **finalisés** (flushés en fin de tour) — visibles publiquement.
   * - `correct` : le guess a matché le secret de la cible.
   * - `avatarSrc` : l'avatar proposé par le guesser.
   * - `targetId` : la grille visée.
   */
  guesses: Array<{ playerId: string; targetId: string; avatarSrc: string; correct: boolean }>;
  /**
   * Guesses en attente, faits durant le tour courant. Cachés du public jusqu'à
   * la fin du tour (reveal commun) pour permettre à plusieurs joueurs d'oser
   * tenter sans s'influencer.
   */
  pendingGuesses: Array<{ playerId: string; targetId: string; avatarSrc: string; correct: boolean }>;
  /**
   * Bans par (guesser → cible) : un joueur ne peut guess qu'une seule fois
   * une grille donnée. Correct ou raté, la tentative consomme son ticket pour
   * cette cible ; il peut toujours guess les autres grilles.
   */
  guessBans: Map<string, Set<string>>;
  /** Nombre de tours joués (incrémenté à chaque fin de tour). */
  turnsPlayed: number;
  /** Round terminé (plus de cible disponible ou ≤1 joueur en vie). */
  ended: boolean;
}

export interface ImposterState {
  sub: 'clue-1' | 'clue-2' | 'vote' | 'guess' | 'done';
  civilianWord: string;
  imposterWord: string;
  aliases: string[];
  imposterId: string;
  /** Ordre de passage (aléatoire) pour les phases d'indices. */
  playerOrder: string[];
  /** Index du joueur qui doit donner son indice (durant clue-1/clue-2). */
  clueTurnIndex: number;
  assignments: Map<string, 'civil' | 'imposter'>;
  /** Indices soumis par tour de table. `[tour0, tour1]`. */
  clues: Array<Map<string, string>>;
  /** `voterId -> targetId`. */
  votes: Map<string, string>;
  /** Deadline de la sous-phase (ou du tour courant en clue). */
  endsAt: number;
  /** Rempli en phase 'guess' ou 'done'. */
  demasque?: boolean;
  imposterGuess?: string;
  guessCorrect?: boolean;
}

/**
 * État du mode rapidité revisité : les joueurs peuvent tenter plusieurs
 * propositions jusqu'à trouver la bonne. La manche s'arrête quand
 * `targetFinders` joueurs ont trouvé OU quand le temps expire.
 */
export interface SpeedElimState {
  /** Deadline dure de la manche (timer question). */
  endsAt: number;
  /** Nombre de finders nécessaires pour terminer la manche. */
  targetFinders: number;
  /** Toutes les tentatives par joueur, dans l'ordre chrono. */
  attempts: Map<string, Array<{ text: string; at: number; correct: boolean }>>;
  /** Date du premier coup gagnant d'un joueur (rempli une seule fois). */
  correctAt: Map<string, number>;
  /** Rang d'arrivée (1 = premier à trouver, 2 = deuxième, etc.). */
  finderRank: Map<string, number>;
  /** Vainqueurs : remplis quand targetFinders est atteint. */
  finishedAt?: number;
}

export type CodenamesColor = 'red' | 'blue' | 'neutral' | 'assassin';

export interface CodenamesTile {
  word: string;
  color: CodenamesColor;
  revealed: boolean;
}

export interface CodenamesState {
  sub: 'clue' | 'guess' | 'done';
  /** 25 tuiles avec leur couleur et statut. */
  grid: CodenamesTile[];
  currentTeam: 'red' | 'blue';
  spymasters: { red: string; blue: string };
  /** Joueurs non-spymasters par équipe (devineurs). */
  guessers: { red: string[]; blue: string[] };
  /** Indice courant (absent tant que le spymaster n'a pas parlé). */
  clue?: { word: string; count: number; byTeam: 'red' | 'blue' };
  /** Tentatives restantes durant la phase guess. */
  guessesLeft: number;
  /** Deadline de la sous-phase courante. */
  endsAt: number;
  /** Historique complet des indices. */
  clueHistory: Array<{ word: string; count: number; byTeam: 'red' | 'blue' }>;
  /** Rempli quand sub === 'done'. */
  winner?: 'red' | 'blue';
  endReason?: 'assassin' | 'allFound' | 'forfeit';
}

export type CollectPhase =
  | { kind: 'parallel'; answers: Map<string, CollectedAnswer>; endsAt: number }
  | { kind: 'turns'; turn: TurnState }
  | { kind: 'hot-potato'; hp: HotPotatoState }
  | { kind: 'guess-who'; gw: GuessWhoState }
  | { kind: 'imposter'; im: ImposterState }
  | { kind: 'codenames'; cn: CodenamesState }
  | { kind: 'speed-elim'; se: SpeedElimState };

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
  | { type: 'hp_player_done'; playerId: string; success: boolean }
  | { type: 'speed_elim_attempt'; playerId: string; correct: boolean };

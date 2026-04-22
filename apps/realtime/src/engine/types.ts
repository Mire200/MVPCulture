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
  /** Nombre de cycles complets sur `turnOrder` déjà joués. */
  cyclesPlayed: number;
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

export type WikiracePlayerStatus = 'running' | 'finished' | 'abandoned' | 'disconnected';

export interface WikiracePlayerState {
  status: WikiracePlayerStatus;
  /** Chemin parcouru, commençant par `startTitle`. Titres normalisés (espaces, pas d'underscore). */
  path: string[];
  startedAt: number;
  finishedAt?: number;
}

export interface WikiraceState {
  startTitle: string;
  targetTitle: string;
  wikiLang: string;
  startedAt: number;
  players: Map<string, WikiracePlayerState>;
  /** Tous les joueurs ont terminé, abandonné ou sont déconnectés. */
  ended: boolean;
}

export interface GarticPhoneEntry {
  type: 'text' | 'drawing';
  playerId: string;
  content: string;
  submittedAt: number;
}

export type GarticPhoneSub = 'write' | 'draw' | 'guess' | 'reveal' | 'done';

export interface GarticPhoneState {
  sub: GarticPhoneSub;
  /** Ordre circulaire des joueurs. */
  playerOrder: string[];
  /** Index de l'étape courante (0 = write, 1 = draw, 2 = guess, …). */
  stepIndex: number;
  /** Nombre total d'étapes (= nombre de joueurs). */
  totalSteps: number;
  /** Chaînes : chainOwner → entrées ordonnées. */
  chains: Map<string, GarticPhoneEntry[]>;
  /** Joueurs ayant soumis à l'étape courante. */
  submitted: Set<string>;
  /** Deadline de l'étape courante. */
  endsAt: number;
  /** Durée par étape texte (ms). */
  writeMs: number;
  /** Durée par étape dessin (ms). */
  drawMs: number;
  /** Index de la chaîne en cours de reveal (phase reveal). */
  revealChainIndex: number;
  /** Index de l'étape courante dans la chaîne de reveal (phase reveal). */
  revealStepIndex: number;
}

export interface BombpartyState {
  playerOrder: string[];
  currentPlayerId: string | null;
  /** Timer total in ms when turn started */
  timerMs: number;
  /** Deadline timestamp for explosion */
  explodesAt: number;
  syllable: string;
  lives: Record<string, number>;
  /** Lettres de l'alphabet déjà utilisées par le joueur */
  alphabets: Record<string, Set<string>>;
  usedWords: Set<string>;
  phase: 'playing' | 'done';
}

export type TtrSub =
  | 'initial-destinations' // Chaque joueur choisit ses billets de départ
  | 'playing' // Boucle normale de tours
  | 'last-round' // Un joueur a déclenché le dernier tour
  | 'done';

export type TtrTurnAction =
  | { kind: 'idle' }
  | { kind: 'drew-one'; tookLoco: boolean }
  | { kind: 'picking-destinations'; drawn: string[]; minKeep: number };

export interface TtrPlayerState {
  trainsLeft: number;
  /** Main : compte par couleur (incluant 'loco'). */
  hand: Record<string, number>;
  /** Billets gardés (ids de TTR_DESTINATIONS). */
  destinations: string[];
  /** Ids de tronçons capturés. */
  claimedRouteIds: string[];
  /** Score partiel cumulé (tronçons uniquement — destinations/longest en fin de partie). */
  scoreFromRoutes: number;
  /** Sélection initiale de destinations pas encore confirmée. */
  pendingInitialDestinations?: string[];
  /** Chaque joueur attend-il encore la confirmation des destinations initiales ? */
  initialDestinationsConfirmed: boolean;
}

export interface TicketToRideState {
  sub: TtrSub;
  turnOrder: string[];
  currentPlayerIndex: number;
  /** Timestamp limite du tour courant. */
  turnEndsAt?: number;
  /** Pioche de cartes wagons (face cachée). */
  deck: string[];
  discard: string[];
  /** Marché de cartes face visible (null = emplacement vide). */
  market: (string | null)[];
  /** Pile de billets destination non distribués. */
  destinationDeck: string[];
  /** Billets initiaux distribués à chaque joueur (privés). */
  initialDestinationsDrawn: Map<string, string[]>;
  players: Map<string, TtrPlayerState>;
  routes: Array<{ id: string; ownerId?: string; paidColor?: string }>;
  /** Joueur qui a déclenché le dernier tour (seuil wagons atteint). */
  lastRoundTriggerId?: string;
  /** Nombre de tours restants en phase last-round (décrémenté à chaque fin de tour). */
  lastRoundTurnsRemaining?: number;
  /** Action en cours durant le tour. */
  turnAction: TtrTurnAction;
}
export type CollectPhase =
  | { kind: 'parallel'; answers: Map<string, CollectedAnswer>; endsAt: number }
  | { kind: 'turns'; turn: TurnState }
  | { kind: 'hot-potato'; hp: HotPotatoState }
  | { kind: 'guess-who'; gw: GuessWhoState }
  | { kind: 'imposter'; im: ImposterState }
  | { kind: 'codenames'; cn: CodenamesState }
  | { kind: 'speed-elim'; se: SpeedElimState }
  | { kind: 'wikirace'; wr: WikiraceState }
  | { kind: 'gartic-phone'; gp: GarticPhoneState }
  | { kind: 'bombparty'; bp: BombpartyState }
  | { kind: 'ticket-to-ride'; ttr: TicketToRideState };

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
  | { type: 'speed_elim_attempt'; playerId: string; correct: boolean }
  | { type: 'bp_invalid_syllable'; playerId: string; word: string }
  | { type: 'bp_already_used'; playerId: string; word: string }
  | { type: 'bp_not_in_dict'; playerId: string; word: string }
  | { type: 'bp_word_accepted'; playerId: string; word: string }
  | { type: 'bp_explosion'; playerId: string }
  // ticket-to-ride
  | { type: 'ttr_turn_started'; currentPlayerId: string }
  | { type: 'ttr_card_drawn'; playerId: string; fromMarket: boolean }
  | { type: 'ttr_route_claimed'; playerId: string; routeId: string; length: number }
  | { type: 'ttr_destinations_taken'; playerId: string; count: number }
  | { type: 'ttr_last_round_triggered'; playerId: string }
  | { type: 'ttr_done' };

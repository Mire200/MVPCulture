import { nanoid } from 'nanoid';
import {
  AVATAR_POOL,
  type GameConfig,
  type HostValidation,
  type LobbyDrawStroke,
  type Player,
  type Question,
  type RoomSnapshot,
  type RoomPhase,
  MAX_PLAYERS_PER_ROOM,
  lobbyPenColorForPlayer,
} from '@mvpc/shared';
import type { GuessWhoState, RoundEvent, RoundState } from '../engine/types.js';
import { getMode } from '../engine/registry.js';
import { buildRoundPlaylist } from '../engine/questionBank.js';
import { listTurnsTick, setRoundPlayers } from '../engine/modes/listTurns.js';
import {
  buildGrid,
  gwAdvanceTurn,
  gwCurrentTargetId,
  gwGetMasks,
  gwMasksForPlayer,
} from '../engine/modes/guessWho.js';
import {
  imCastVote,
  imCurrentClueSpeakerId,
  imSubmitClue,
  imSubmitGuess,
  imTick,
  imWordFor,
} from '../engine/modes/imposter.js';
import {
  cnEndTurn,
  cnGuessTile,
  cnKeyColors,
  cnSubmitClue,
  cnTick,
} from '../engine/modes/codenames.js';
import type { CodenamesColor } from '../engine/types.js';
import type { CodenamesTeam } from '@mvpc/shared';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 5): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return s;
}

const DEFAULT_CONFIG: GameConfig = {
  rounds: 8,
  modesPool: ['classic', 'estimation', 'list-turns'],
  difficulty: 'mixed',
  answerTimeSeconds: 30,
  categoriesPool: [],
};

export class Room {
  readonly code: string;
  readonly createdAt: number;
  phase: RoomPhase = 'lobby';
  hostId: string;
  config: GameConfig = { ...DEFAULT_CONFIG };

  players: Map<string, Player> = new Map();
  socketsByPlayer: Map<string, string> = new Map();

  playlist: Question[] = [];
  roundIndex = -1;
  round?: RoundState;

  /** Dessin collaboratif du lobby (effacé au lancement de partie). */
  lobbyDrawing: LobbyDrawStroke[] = [];

  // ID de la socket associée au joueur hôte (pour reconnexion).
  constructor(hostId: string, code?: string) {
    this.code = code ?? generateRoomCode();
    this.hostId = hostId;
    this.createdAt = Date.now();
  }

  static newPlayer(data: { nickname: string; avatar: Player['avatar']; isHost: boolean }): Player {
    return {
      id: nanoid(12),
      nickname: data.nickname,
      avatar: data.avatar,
      isHost: data.isHost,
      connected: true,
      score: 0,
      joinedAt: Date.now(),
    };
  }

  addPlayer(player: Player): void {
    if (this.players.size >= MAX_PLAYERS_PER_ROOM) throw new Error('ROOM_FULL');
    this.players.set(player.id, player);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.socketsByPlayer.delete(playerId);
  }

  setPlayerConnected(playerId: string, connected: boolean): void {
    const p = this.players.get(playerId);
    if (p) p.connected = connected;
  }

  activePlayers(): Player[] {
    return [...this.players.values()].filter((p) => p.connected);
  }

  allPlayers(): Player[] {
    return [...this.players.values()];
  }

  reassignHost(): void {
    const candidates = this.activePlayers();
    if (candidates.length === 0) return;
    const newHost = candidates[0]!;
    for (const p of this.players.values()) p.isHost = false;
    newHost.isHost = true;
    this.hostId = newHost.id;
  }

  startGame(partial?: Partial<GameConfig>): void {
    if (this.phase !== 'lobby' && this.phase !== 'match_final') {
      throw new Error('ROOM_ALREADY_STARTED');
    }
    this.lobbyDrawing = [];
    this.config = { ...DEFAULT_CONFIG, ...this.config, ...(partial ?? {}) };
    if (this.config.modesPool.includes('imposter') && this.allPlayers().length < 3) {
      throw new Error('NOT_ENOUGH_PLAYERS');
    }
    if (this.config.modesPool.includes('codenames')) {
      const red = this.allPlayers().filter((p) => p.cnTeam === 'red').length;
      const blue = this.allPlayers().filter((p) => p.cnTeam === 'blue').length;
      if (red < 2 || blue < 2) {
        throw new Error('NOT_ENOUGH_PLAYERS');
      }
    }
    this.playlist = buildRoundPlaylist(this.config);
    this.roundIndex = -1;
    for (const p of this.players.values()) p.score = 0;
    this.nextRound();
  }

  /**
   * L'hôte met à jour la config depuis le lobby sans lancer la partie.
   * Utile pour que les autres joueurs voient en temps réel le mode choisi
   * (ex. afficher le panel d'équipes Codenames).
   */
  setLobbyConfig(partial: Partial<GameConfig>): void {
    if (this.phase !== 'lobby' && this.phase !== 'match_final') {
      throw new Error('PHASE_MISMATCH');
    }
    this.config = { ...this.config, ...partial };
    // Si on quitte le mode codenames, on nettoie les préférences d'équipes
    // pour que l'UI d'accueil reprenne un état neutre.
    if (!this.config.modesPool.includes('codenames')) {
      for (const p of this.players.values()) {
        if (p.cnTeam !== undefined) p.cnTeam = undefined;
        if (p.cnWantsSpymaster) p.cnWantsSpymaster = false;
      }
    }
  }

  /** Mutation des préférences Codenames (lobby uniquement). */
  setCnTeam(playerId: string, team: CodenamesTeam): void {
    if (this.phase !== 'lobby' && this.phase !== 'match_final') {
      throw new Error('PHASE_MISMATCH');
    }
    const p = this.players.get(playerId);
    if (!p) throw new Error('NOT_IN_ROOM');
    p.cnTeam = team;
    // Si le joueur quitte son équipe, il perd son statut de volontaire.
    if (team === 'spectator') p.cnWantsSpymaster = false;
  }

  setCnWantsSpymaster(playerId: string, wants: boolean): void {
    if (this.phase !== 'lobby' && this.phase !== 'match_final') {
      throw new Error('PHASE_MISMATCH');
    }
    const p = this.players.get(playerId);
    if (!p) throw new Error('NOT_IN_ROOM');
    if (wants && p.cnTeam !== 'red' && p.cnTeam !== 'blue') {
      throw new Error('INVALID_PAYLOAD');
    }
    p.cnWantsSpymaster = wants;
  }

  nextRound(): void {
    this.roundIndex += 1;
    if (this.roundIndex >= this.playlist.length) {
      this.phase = 'match_final';
      this.round = undefined;
      return;
    }
    const q = this.playlist[this.roundIndex]!;
    const mode = getMode(q.mode);
    this.round = mode.prepare(
      {
        players: this.allPlayers(),
        question: q,
        roundIndex: this.roundIndex,
        now: () => Date.now(),
      },
      this.config.answerTimeSeconds,
    );
    if (this.round.mode === 'list-turns') {
      setRoundPlayers(this.round, this.allPlayers());
    }
    this.phase = 'round_collect';
  }

  submitAnswer(
    playerId: string,
    payload: {
      text?: string;
      numeric?: number;
      listItem?: string;
      bid?: number;
      lat?: number;
      lng?: number;
      order?: string[];
    },
  ) {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    const mode = getMode(this.round.mode);
    if (this.round.mode === 'list-turns') setRoundPlayers(this.round, this.allPlayers());
    const res = mode.acceptAnswer(this.round, playerId, payload);
    if (!res.ok) throw new Error(res.code);
    return res.events;
  }

  /** Retourne `true` si la sous-phase imposter a changé lors de ce tick. */
  imPhaseChangedInLastTick = false;
  /** Retourne `true` si la sous-phase codenames a changé lors de ce tick. */
  cnPhaseChangedInLastTick = false;
  /** Retourne `true` si la sous-phase hot-potato (bid→answer) a changé lors de ce tick. */
  hpPhaseChangedInLastTick = false;

  tick(): RoundEvent[] {
    this.imPhaseChangedInLastTick = false;
    this.cnPhaseChangedInLastTick = false;
    this.hpPhaseChangedInLastTick = false;
    if (!this.round || this.phase !== 'round_collect') return [];
    if (this.round.mode === 'list-turns') {
      setRoundPlayers(this.round, this.allPlayers());
      const res = listTurnsTick(this.round, this.allPlayers());
      if (res.expired) {
        // Important : passer par goToReveal() pour construire le payload de
        // reveal. Sinon l'intervalle serveur ne peut pas émettre round:reveal
        // et les clients restent coincés sur la phase collect.
        this.goToReveal();
      }
      return res.events;
    }
    // Pour hot-potato : déclenche la transition bid→answer si timeout.
    // On surveille le changement de sous-phase pour déclencher un rebroadcast
    // (sinon les clients qui n'ont pas misé restent figés sur l'écran "Je mise").
    if (this.round.mode === 'hot-potato' && this.round.collect.kind === 'hot-potato') {
      const prevPhase = this.round.collect.hp.phase;
      const mode = getMode(this.round.mode);
      mode.isCollectComplete(this.round, this.allPlayers());
      if (this.round.collect.hp.phase !== prevPhase) {
        this.hpPhaseChangedInLastTick = true;
      }
    }
    // Imposter : gère les timeouts des sous-phases.
    if (this.round.mode === 'imposter' && this.round.collect.kind === 'imposter') {
      const prev = this.round.collect.im.sub;
      imTick(this.round.collect.im, this.allPlayers(), Date.now());
      if (this.round.collect.im.sub !== prev) {
        this.imPhaseChangedInLastTick = true;
      }
    }
    // Codenames : gère les timeouts clue/guess.
    if (this.round.mode === 'codenames' && this.round.collect.kind === 'codenames') {
      const cn = this.round.collect.cn;
      const prevSub = cn.sub;
      const prevTeam = cn.currentTeam;
      cnTick(cn, Date.now());
      if (cn.sub !== prevSub || cn.currentTeam !== prevTeam) {
        this.cnPhaseChangedInLastTick = true;
      }
    }
    return [];
  }

  shouldAutoReveal(): boolean {
    if (!this.round || this.phase !== 'round_collect') return false;
    const mode = getMode(this.round.mode);
    return mode.isCollectComplete(this.round, this.allPlayers());
  }

  goToReveal() {
    if (!this.round) return;
    this.phase = 'round_reveal';
    const mode = getMode(this.round.mode);
    this.round.reveal = mode.buildReveal(this.round, this.allPlayers());
    this.round.revealed = true;
  }

  applyHostValidations(validations: HostValidation[]): void {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    for (const v of validations) {
      this.round.hostValidations[v.playerId] = v.correct;
    }
  }

  computeAndApplyScoring(hostValidations?: HostValidation[]) {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    const mode = getMode(this.round.mode);
    const scoring = mode.computeScores(this.round, this.allPlayers(), hostValidations);
    this.round.scoring = scoring;
    for (const p of this.players.values()) {
      const total = scoring.totals[p.id];
      if (typeof total === 'number') p.score = total;
    }
    this.phase = 'round_score';
    return scoring;
  }

  standings(): Player[] {
    return [...this.players.values()].sort((a, b) => b.score - a.score);
  }

  private buildPublicRound() {
    const r = this.round!;
    let endsAt: number | undefined;
    let currentPlayerId: string | undefined;
    let hpPhase: 'bid' | 'answer' | undefined;
    let hpProgress: Record<string, { bid?: number; count: number; done: boolean }> | undefined;
    let turnOrder: string[] | undefined;
    let turnEliminated: string[] | undefined;
    let gwPhase: 'select' | 'play' | undefined;
    let gwSecrets: Record<string, boolean> | undefined;
    let gwEliminated: string[] | undefined;
    let gwRevealed: Record<string, string> | undefined;
    let gwCurrentGrid: string[] | undefined;
    let gwGuesses:
      | Array<{ playerId: string; targetId: string; avatarSrc: string; correct: boolean }>
      | undefined;
    let imPhase: 'clue-1' | 'clue-2' | 'vote' | 'guess' | 'done' | undefined;
    let imClues: Array<Record<string, string>> | undefined;
    let imVoters: string[] | undefined;
    let imImposterId: string | undefined;
    let imDemasque: boolean | undefined;
    let imGuess: string | undefined;
    let imGuessCorrect: boolean | undefined;
    let imVoteTally: Record<string, number> | undefined;
    let cnPhase: 'clue' | 'guess' | 'done' | undefined;
    let cnGrid: Array<{ word: string; color?: 'red' | 'blue' | 'neutral' | 'assassin' }> | undefined;
    let cnCurrentTeam: 'red' | 'blue' | undefined;
    let cnSpymasters: { red: string; blue: string } | undefined;
    let cnClue: { word: string; count: number; byTeam: 'red' | 'blue' } | undefined;
    let cnGuessesLeft: number | undefined;
    let cnRemaining: { red: number; blue: number } | undefined;
    let cnWinner: 'red' | 'blue' | undefined;
    let cnEndReason: 'assassin' | 'allFound' | 'forfeit' | undefined;
    let cnClueHistory: Array<{ word: string; count: number; byTeam: 'red' | 'blue' }> | undefined;
    let seTargetFinders: number | undefined;
    let seFinders: string[] | undefined;
    let seAttemptCount: Record<string, number> | undefined;
    if (r.collect.kind === 'parallel') {
      endsAt = r.collect.endsAt;
    } else if (r.collect.kind === 'turns') {
      endsAt = r.collect.turn.endsAt;
      currentPlayerId = r.collect.turn.currentPlayerId;
      turnOrder = [...r.collect.turn.order];
      turnEliminated = [...r.collect.turn.eliminatedOrder];
    } else if (r.collect.kind === 'hot-potato') {
      hpPhase = r.collect.hp.phase === 'bid' ? 'bid' : 'answer';
      endsAt = hpPhase === 'bid' ? r.collect.hp.bidEndsAt : r.collect.hp.answerEndsAt;
      hpProgress = {};
      for (const [pid, s] of Object.entries(r.collect.hp.players)) {
        hpProgress[pid] = { bid: s.bid, count: s.items.length, done: s.done };
      }
    } else if (r.collect.kind === 'guess-who') {
      const gw = r.collect.gw;
      gwPhase = gw.sub;
      currentPlayerId = gwCurrentTargetId(gw);
      gwSecrets = {};
      for (const p of this.allPlayers()) {
        gwSecrets[p.id] = gw.secrets.has(p.id);
      }
      gwEliminated = [...gw.eliminated];
      gwRevealed = Object.fromEntries(gw.revealed.entries());
      if (currentPlayerId) {
        gwCurrentGrid = gw.grids.get(currentPlayerId);
      }
      // `gw.guesses` n'inclut QUE les guesses flushés en fin de tour ;
      // les tentatives en cours (pendingGuesses) restent privées.
      gwGuesses = gw.guesses.map((g) => ({ ...g }));
    } else if (r.collect.kind === 'imposter') {
      const im = r.collect.im;
      imPhase = im.sub;
      endsAt = im.endsAt;
      // Indices déjà soumis (toujours public — l'identité ne l'est pas).
      imClues = im.clues.map((m) => Object.fromEntries(m.entries()));
      // Voteurs (identité publique mais pas la cible) tant que vote en cours.
      imVoters = [...im.votes.keys()];
      // Met en évidence le joueur dont c'est le tour (indice) ou l'imposteur
      // (en phase guess) pour que l'UI pulse son avatar automatiquement.
      if (im.sub === 'clue-1' || im.sub === 'clue-2') {
        currentPlayerId = imCurrentClueSpeakerId(im);
      } else if (im.sub === 'guess') {
        currentPlayerId = im.imposterId;
      }
      // Données sensibles : uniquement exposées une fois la manche terminée.
      const revealSafe = im.sub === 'done' || im.sub === 'guess' || this.phase === 'round_reveal';
      if (revealSafe) {
        imImposterId = im.imposterId;
        imDemasque = im.demasque;
        imGuess = im.imposterGuess;
        imGuessCorrect = im.guessCorrect;
        const tally: Record<string, number> = {};
        for (const [, t] of im.votes) tally[t] = (tally[t] ?? 0) + 1;
        imVoteTally = tally;
      }
    } else if (r.collect.kind === 'speed-elim') {
      const se = r.collect.se;
      endsAt = se.endsAt;
      seTargetFinders = se.targetFinders;
      const finders = [...se.finderRank.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
      seFinders = finders;
      const counts: Record<string, number> = {};
      for (const [pid, list] of se.attempts.entries()) counts[pid] = list.length;
      seAttemptCount = counts;
    } else if (r.collect.kind === 'codenames') {
      const cn = r.collect.cn;
      cnPhase = cn.sub;
      endsAt = cn.endsAt;
      cnCurrentTeam = cn.currentTeam;
      cnSpymasters = { ...cn.spymasters };
      cnClue = cn.clue ? { ...cn.clue } : undefined;
      cnGuessesLeft = cn.guessesLeft;
      cnClueHistory = [...cn.clueHistory];
      const revealSafe = cn.sub === 'done' || this.phase === 'round_reveal';
      cnGrid = cn.grid.map((t) => ({
        word: t.word,
        // Couleur publique uniquement pour les tuiles déjà révélées, ou à la fin.
        color: t.revealed || revealSafe ? t.color : undefined,
      }));
      cnRemaining = {
        red: cn.grid.filter((t) => t.color === 'red' && !t.revealed).length,
        blue: cn.grid.filter((t) => t.color === 'blue' && !t.revealed).length,
      };
      if (revealSafe) {
        cnWinner = cn.winner;
        cnEndReason = cn.endReason;
      }
      // Met en évidence le spymaster actif pendant la phase clue.
      if (cn.sub === 'clue') {
        currentPlayerId = cn.spymasters[cn.currentTeam];
      }
    }
    return {
      roundIndex: r.roundIndex,
      question: r.publicQuestion,
      mode: r.mode,
      phase: this.phase,
      endsAt,
      currentPlayerId,
      turnOrder,
      turnEliminated,
      hpPhase,
      hpProgress,
      gwPhase,
      gwSecrets,
      gwEliminated,
      gwRevealed,
      gwCurrentGrid,
      gwGuesses,
      imPhase,
      imClues,
      imVoters,
      imImposterId,
      imDemasque,
      imGuess,
      imGuessCorrect,
      imVoteTally,
      cnPhase,
      cnGrid,
      cnCurrentTeam,
      cnSpymasters,
      cnClue,
      cnGuessesLeft,
      cnRemaining,
      cnWinner,
      cnEndReason,
      cnClueHistory,
      seTargetFinders,
      seFinders,
      seAttemptCount,
    };
  }

  gwPickSecret(playerId: string, avatarSrc: string): void {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'guess-who') throw new Error('PHASE_MISMATCH');
    const gw = this.round.collect.gw;
    if (gw.sub !== 'select') throw new Error('PHASE_MISMATCH');
    if (!AVATAR_POOL.includes(avatarSrc)) throw new Error('INVALID_PAYLOAD');
    if (!this.players.has(playerId)) throw new Error('NOT_IN_ROOM');
    gw.secrets.set(playerId, avatarSrc);
    gw.grids.set(playerId, buildGrid(avatarSrc));
    const everyonePicked = this.allPlayers().every((p) => gw.secrets.has(p.id));
    if (everyonePicked && this.allPlayers().length >= 2) {
      gw.sub = 'play';
      const firstAlive = gw.turnOrder.findIndex((id) => !gw.eliminated.has(id));
      gw.currentTargetIndex = Math.max(0, firstAlive);
    }
  }

  gwToggleMask(
    maskerId: string,
    targetId: string,
    avatarSrc: string,
    masked: boolean,
  ): void {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'guess-who') throw new Error('PHASE_MISMATCH');
    const gw = this.round.collect.gw;
    if (gw.sub !== 'play') throw new Error('PHASE_MISMATCH');
    if (!this.players.has(maskerId)) throw new Error('NOT_IN_ROOM');
    const grid = gw.grids.get(targetId);
    if (!grid || !grid.includes(avatarSrc)) throw new Error('INVALID_PAYLOAD');
    const set = gwGetMasks(gw, maskerId, targetId);
    if (masked) set.add(avatarSrc);
    else set.delete(avatarSrc);
  }

  gwMasksSnapshot(playerId: string): Record<string, string[]> {
    if (!this.round) return {};
    if (this.round.collect.kind !== 'guess-who') return {};
    return gwMasksForPlayer(this.round.collect.gw, playerId);
  }

  /**
   * Finalise le tour courant :
   * 1. Flushe `pendingGuesses` dans `gw.guesses` (rend tout public)
   * 2. Si au moins un pending était correct : la cible est éliminée et son
   *    avatar révélé (retourné pour broadcast `guessWho:playerEliminated`).
   * 3. Incrémente `turnsPlayed`, avance ou marque la manche finie.
   *
   * `forceEliminateTarget` : utilisé par `gwSelfEliminate` quand la cible
   * concède sans qu'on ait besoin d'un guess correct.
   */
  private gwFinalizeTurn(
    gw: GuessWhoState,
    forceEliminateTarget: boolean,
  ): { eliminatedTargetId?: string; revealedAvatar?: string; completed: boolean } {
    const targetId = gw.turnOrder[gw.currentTargetIndex];
    const hasCorrect = gw.pendingGuesses.some((g) => g.correct);
    // Flush : toutes les tentatives en cours deviennent publiques.
    for (const g of gw.pendingGuesses) gw.guesses.push(g);
    gw.pendingGuesses = [];
    let eliminatedTargetId: string | undefined;
    let revealedAvatar: string | undefined;
    if (targetId && (hasCorrect || forceEliminateTarget) && !gw.eliminated.has(targetId)) {
      const secret = gw.secrets.get(targetId);
      gw.eliminated.add(targetId);
      if (secret) gw.revealed.set(targetId, secret);
      eliminatedTargetId = targetId;
      revealedAvatar = secret;
    }
    gw.turnsPlayed += 1;
    const aliveCount = gw.turnOrder.filter((id) => !gw.eliminated.has(id)).length;
    let completed = false;
    if (aliveCount <= 1) {
      gw.ended = true;
      completed = true;
    } else {
      const advanced = gwAdvanceTurn(gw);
      if (!advanced) completed = true;
    }
    return { eliminatedTargetId, revealedAvatar, completed };
  }

  gwNextTurn(callerId: string): {
    eliminatedTargetId?: string;
    revealedAvatar?: string;
    completed: boolean;
  } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'guess-who') throw new Error('PHASE_MISMATCH');
    const gw = this.round.collect.gw;
    if (gw.sub !== 'play') throw new Error('PHASE_MISMATCH');
    const currentId = gwCurrentTargetId(gw);
    if (currentId !== callerId) throw new Error('NOT_YOUR_TURN');
    return this.gwFinalizeTurn(gw, false);
  }

  imWordFor(playerId: string): { word: string } | undefined {
    if (!this.round) return undefined;
    if (this.round.collect.kind !== 'imposter') return undefined;
    return imWordFor(this.round.collect.im, playerId);
  }

  imSubmitClue(
    playerId: string,
    clue: string,
  ): { advanced: boolean; completed: boolean } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'imposter') throw new Error('PHASE_MISMATCH');
    if (!this.players.has(playerId)) throw new Error('NOT_IN_ROOM');
    const res = imSubmitClue(
      this.round.collect.im,
      playerId,
      clue,
      this.allPlayers(),
      Date.now(),
    );
    if (!res.accepted) throw new Error(res.code ?? 'INTERNAL');
    return { advanced: res.advanced, completed: this.round.collect.im.sub === 'done' };
  }

  imVote(
    voterId: string,
    targetId: string,
  ): { advanced: boolean; completed: boolean } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'imposter') throw new Error('PHASE_MISMATCH');
    if (!this.players.has(voterId)) throw new Error('NOT_IN_ROOM');
    const res = imCastVote(
      this.round.collect.im,
      voterId,
      targetId,
      this.allPlayers(),
      Date.now(),
    );
    if (!res.accepted) throw new Error(res.code ?? 'INTERNAL');
    return { advanced: res.advanced, completed: this.round.collect.im.sub === 'done' };
  }

  imSubmitGuess(
    playerId: string,
    guess: string,
  ): { advanced: boolean; completed: boolean } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'imposter') throw new Error('PHASE_MISMATCH');
    if (!this.players.has(playerId)) throw new Error('NOT_IN_ROOM');
    const res = imSubmitGuess(this.round.collect.im, playerId, guess, Date.now());
    if (!res.accepted) throw new Error(res.code ?? 'INTERNAL');
    return { advanced: res.advanced, completed: this.round.collect.im.sub === 'done' };
  }

  /** Retourne la clé (25 couleurs) si `playerId` est spymaster. */
  cnKeyFor(playerId: string): { key: CodenamesColor[] } | undefined {
    if (!this.round) return undefined;
    if (this.round.collect.kind !== 'codenames') return undefined;
    const cn = this.round.collect.cn;
    if (cn.spymasters.red !== playerId && cn.spymasters.blue !== playerId) return undefined;
    return { key: cnKeyColors(cn) };
  }

  cnSubmitClue(
    playerId: string,
    word: string,
    count: number,
  ): { completed: boolean } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'codenames') throw new Error('PHASE_MISMATCH');
    if (!this.players.has(playerId)) throw new Error('NOT_IN_ROOM');
    const res = cnSubmitClue(
      this.round.collect.cn,
      playerId,
      word,
      count,
      Date.now(),
    );
    if (!res.accepted) throw new Error(res.code ?? 'INTERNAL');
    return { completed: this.round.collect.cn.sub === 'done' };
  }

  cnGuessTile(
    playerId: string,
    index: number,
  ): { completed: boolean } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'codenames') throw new Error('PHASE_MISMATCH');
    if (!this.players.has(playerId)) throw new Error('NOT_IN_ROOM');
    const res = cnGuessTile(this.round.collect.cn, playerId, index, Date.now());
    if (!res.accepted) throw new Error(res.code ?? 'INTERNAL');
    return { completed: this.round.collect.cn.sub === 'done' };
  }

  cnEndTurn(playerId: string): { completed: boolean } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'codenames') throw new Error('PHASE_MISMATCH');
    if (!this.players.has(playerId)) throw new Error('NOT_IN_ROOM');
    const res = cnEndTurn(this.round.collect.cn, playerId, Date.now());
    if (!res.accepted) throw new Error(res.code ?? 'INTERNAL');
    return { completed: this.round.collect.cn.sub === 'done' };
  }

  gwSelfEliminate(callerId: string): {
    eliminatedTargetId?: string;
    revealedAvatar?: string;
    completed: boolean;
  } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'guess-who') throw new Error('PHASE_MISMATCH');
    const gw = this.round.collect.gw;
    if (gw.sub !== 'play') throw new Error('PHASE_MISMATCH');
    const currentId = gwCurrentTargetId(gw);
    if (currentId !== callerId) throw new Error('NOT_YOUR_TURN');
    if (!gw.secrets.get(callerId)) throw new Error('INVALID_PAYLOAD');
    return this.gwFinalizeTurn(gw, true);
  }

  /**
   * Tentative de "guess" **privée** : seul le guesser connaît le résultat
   * (via ack). Les pending guesses sont stockées côté serveur et flushées
   * dans `gw.guesses` (publique) uniquement à la fin du tour, pour laisser
   * chance aux autres joueurs de tenter sans être influencés.
   *
   * Règles :
   * - Chaque joueur ne peut guess qu'**une seule fois** une cible donnée
   *   (correct ou raté, le ticket est consommé).
   * - Un guess raté n'élimine PAS le guesser ni ne révèle son avatar ; il
   *   peut toujours tenter sur les autres grilles (autres tours).
   * - Un guess correct éliminera la cible au flush, avec reveal public.
   */
  gwGuess(
    callerId: string,
    avatarSrc: string,
  ): {
    targetId: string;
    correct: boolean;
  } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'guess-who') throw new Error('PHASE_MISMATCH');
    const gw = this.round.collect.gw;
    if (gw.sub !== 'play') throw new Error('PHASE_MISMATCH');
    if (!this.players.has(callerId)) throw new Error('NOT_IN_ROOM');
    if (gw.eliminated.has(callerId)) throw new Error('PHASE_MISMATCH');
    const targetId = gwCurrentTargetId(gw);
    if (!targetId) throw new Error('PHASE_MISMATCH');
    if (targetId === callerId) throw new Error('NOT_YOUR_TURN');
    const bans = gw.guessBans.get(callerId);
    if (bans?.has(targetId)) throw new Error('ALREADY_ANSWERED');
    const secret = gw.secrets.get(targetId);
    if (!secret) throw new Error('INVALID_PAYLOAD');
    const grid = gw.grids.get(targetId);
    if (!grid || !grid.includes(avatarSrc)) throw new Error('INVALID_PAYLOAD');
    const correct = avatarSrc === secret;
    gw.pendingGuesses.push({ playerId: callerId, targetId, avatarSrc, correct });
    // Un joueur ne peut tenter qu'une fois par cible, gagné ou perdu.
    let set = gw.guessBans.get(callerId);
    if (!set) {
      set = new Set();
      gw.guessBans.set(callerId, set);
    }
    set.add(targetId);
    return { targetId, correct };
  }

  private static readonly MAX_LOBBY_STROKES = 900;

  appendLobbyStroke(playerId: string, data: Omit<LobbyDrawStroke, 'id' | 'playerId' | 'color'>): LobbyDrawStroke {
    const color = lobbyPenColorForPlayer(this.allPlayers(), playerId);
    const stroke: LobbyDrawStroke = {
      id: nanoid(10),
      playerId,
      color,
      widthNorm: data.widthNorm,
      points: data.points,
    };
    this.lobbyDrawing.push(stroke);
    while (this.lobbyDrawing.length > Room.MAX_LOBBY_STROKES) {
      this.lobbyDrawing.shift();
    }
    return stroke;
  }

  clearLobbyDrawing(): void {
    this.lobbyDrawing = [];
  }

  snapshot(): RoomSnapshot {
    return {
      code: this.code,
      phase: this.phase,
      players: this.allPlayers(),
      hostId: this.hostId,
      config: this.config,
      roundIndex: this.roundIndex,
      totalRounds: this.config.rounds,
      round: this.round ? this.buildPublicRound() : undefined,
      createdAt: this.createdAt,
    };
  }
}

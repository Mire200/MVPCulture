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
import type { RoundEvent, RoundState } from '../engine/types.js';
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
    this.playlist = buildRoundPlaylist(this.config);
    this.roundIndex = -1;
    for (const p of this.players.values()) p.score = 0;
    this.nextRound();
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

  tick(): RoundEvent[] {
    if (!this.round || this.phase !== 'round_collect') return [];
    if (this.round.mode === 'list-turns') {
      setRoundPlayers(this.round, this.allPlayers());
      const res = listTurnsTick(this.round, this.allPlayers());
      if (res.expired) {
        this.phase = 'round_reveal';
      }
      return res.events;
    }
    // Pour hot-potato : déclenche la transition bid→answer si timeout.
    if (this.round.mode === 'hot-potato') {
      const mode = getMode(this.round.mode);
      mode.isCollectComplete(this.round, this.allPlayers());
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
    let gwPhase: 'select' | 'play' | undefined;
    let gwSecrets: Record<string, boolean> | undefined;
    let gwEliminated: string[] | undefined;
    let gwRevealed: Record<string, string> | undefined;
    let gwCurrentGrid: string[] | undefined;
    let gwWinnerId: string | undefined;
    if (r.collect.kind === 'parallel') {
      endsAt = r.collect.endsAt;
    } else if (r.collect.kind === 'turns') {
      endsAt = r.collect.turn.endsAt;
      currentPlayerId = r.collect.turn.currentPlayerId;
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
      gwWinnerId = gw.winnerId;
    }
    return {
      roundIndex: r.roundIndex,
      question: r.publicQuestion,
      mode: r.mode,
      phase: this.phase,
      endsAt,
      currentPlayerId,
      hpPhase,
      hpProgress,
      gwPhase,
      gwSecrets,
      gwEliminated,
      gwRevealed,
      gwCurrentGrid,
      gwWinnerId,
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

  gwNextTurn(callerId: string): void {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'guess-who') throw new Error('PHASE_MISMATCH');
    const gw = this.round.collect.gw;
    if (gw.sub !== 'play') throw new Error('PHASE_MISMATCH');
    const currentId = gwCurrentTargetId(gw);
    if (currentId !== callerId) throw new Error('NOT_YOUR_TURN');
    gwAdvanceTurn(gw);
  }

  gwSelfEliminate(callerId: string): {
    revealedAvatar: string;
    completed: boolean;
  } {
    if (!this.round) throw new Error('PHASE_MISMATCH');
    if (this.phase !== 'round_collect') throw new Error('PHASE_MISMATCH');
    if (this.round.collect.kind !== 'guess-who') throw new Error('PHASE_MISMATCH');
    const gw = this.round.collect.gw;
    if (gw.sub !== 'play') throw new Error('PHASE_MISMATCH');
    const currentId = gwCurrentTargetId(gw);
    if (currentId !== callerId) throw new Error('NOT_YOUR_TURN');
    const secret = gw.secrets.get(callerId);
    if (!secret) throw new Error('INVALID_PAYLOAD');
    gw.eliminated.add(callerId);
    gw.revealed.set(callerId, secret);
    const aliveCount = gw.turnOrder.filter((id) => !gw.eliminated.has(id)).length;
    let completed = false;
    if (aliveCount <= 1) {
      const winner = gw.turnOrder.find((id) => !gw.eliminated.has(id));
      if (winner) gw.winnerId = winner;
      completed = true;
    } else {
      gwAdvanceTurn(gw);
    }
    return { revealedAvatar: secret, completed };
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

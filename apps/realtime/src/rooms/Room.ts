import { nanoid } from 'nanoid';
import {
  type GameConfig,
  type HostValidation,
  type Player,
  type Question,
  type RoomSnapshot,
  type RoomPhase,
  MAX_PLAYERS_PER_ROOM,
} from '@mvpc/shared';
import type { RoundEvent, RoundState } from '../engine/types.js';
import { getMode } from '../engine/registry.js';
import { buildRoundPlaylist } from '../engine/questionBank.js';
import { listTurnsTick, setRoundPlayers } from '../engine/modes/listTurns.js';

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
    };
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

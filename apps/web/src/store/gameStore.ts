'use client';
import { create } from 'zustand';
import type {
  HostValidation,
  Player,
  RoomSnapshot,
  RoundReveal,
  RoundScoring,
} from '@mvpc/shared';

type Reason = 'duplicate' | 'invalid' | 'timeout';

export interface GameState {
  connected: boolean;
  code: string | null;
  playerId: string | null;
  snapshot: RoomSnapshot | null;
  reveal: RoundReveal | null;
  scoring: RoundScoring | null;
  finalStandings: Player[] | null;
  hostValidations: Record<string, boolean>;
  answeredPlayerIds: Set<string>;
  eliminations: Array<{ playerId: string; reason: Reason }>;
  lastError: { code: string; message: string } | null;

  setConnected: (c: boolean) => void;
  setRoom: (code: string, playerId: string) => void;
  setSnapshot: (s: RoomSnapshot) => void;
  setReveal: (r: RoundReveal | null) => void;
  setScoring: (s: RoundScoring | null) => void;
  setFinalStandings: (s: Player[] | null) => void;
  markPlayerAnswered: (id: string) => void;
  resetRoundLocal: () => void;
  pushElimination: (e: { playerId: string; reason: Reason }) => void;
  setHostValidation: (playerId: string, correct: boolean) => void;
  setHostValidations: (v: HostValidation[]) => void;
  setError: (e: { code: string; message: string } | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  connected: false,
  code: null,
  playerId: null,
  snapshot: null,
  reveal: null,
  scoring: null,
  finalStandings: null,
  hostValidations: {},
  answeredPlayerIds: new Set(),
  eliminations: [],
  lastError: null,

  setConnected: (connected) => set({ connected }),
  setRoom: (code, playerId) => set({ code, playerId }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setReveal: (reveal) => set({ reveal }),
  setScoring: (scoring) => set({ scoring }),
  setFinalStandings: (finalStandings) => set({ finalStandings }),
  markPlayerAnswered: (id) =>
    set((s) => {
      const next = new Set(s.answeredPlayerIds);
      next.add(id);
      return { answeredPlayerIds: next };
    }),
  pushElimination: (e) =>
    set((s) => ({ eliminations: [...s.eliminations, e] })),
  resetRoundLocal: () =>
    set({
      reveal: null,
      scoring: null,
      answeredPlayerIds: new Set(),
      eliminations: [],
      hostValidations: {},
    }),
  setHostValidation: (playerId, correct) =>
    set((s) => ({ hostValidations: { ...s.hostValidations, [playerId]: correct } })),
  setHostValidations: (v) =>
    set(() => {
      const next: Record<string, boolean> = {};
      for (const entry of v) next[entry.playerId] = entry.correct;
      return { hostValidations: next };
    }),
  setError: (lastError) => set({ lastError }),
  reset: () =>
    set({
      connected: false,
      code: null,
      playerId: null,
      snapshot: null,
      reveal: null,
      scoring: null,
      finalStandings: null,
      hostValidations: {},
      answeredPlayerIds: new Set(),
      eliminations: [],
      lastError: null,
    }),
}));

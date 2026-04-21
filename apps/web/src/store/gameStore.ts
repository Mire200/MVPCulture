'use client';
import { create } from 'zustand';
import type {
  HostValidation,
  LobbyDrawStroke,
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
  gwMySecret: string | null;
  gwMasks: Record<string, Set<string>>;
  imposterMyWord: string | null;
  cnMyKey: Array<'red' | 'blue' | 'neutral' | 'assassin'> | null;
  lobbyDrawing: LobbyDrawStroke[];

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
  setGwMySecret: (secret: string | null) => void;
  setGwMasks: (byTarget: Record<string, string[]>) => void;
  setImposterYourWord: (payload: { word: string } | null) => void;
  setCnMyKey: (key: Array<'red' | 'blue' | 'neutral' | 'assassin'> | null) => void;
  setLobbyDrawing: (strokes: LobbyDrawStroke[]) => void;
  appendLobbyStroke: (stroke: LobbyDrawStroke) => void;
  clearLobbyDrawing: () => void;
  reset: () => void;
}

const GW_SECRET_KEY_PREFIX = 'mvpc.gw.secret.';

function loadGwSecret(code: string | null): string | null {
  if (typeof window === 'undefined' || !code) return null;
  return localStorage.getItem(GW_SECRET_KEY_PREFIX + code);
}

function persistGwSecret(code: string | null, secret: string | null) {
  if (typeof window === 'undefined' || !code) return;
  if (secret) localStorage.setItem(GW_SECRET_KEY_PREFIX + code, secret);
  else localStorage.removeItem(GW_SECRET_KEY_PREFIX + code);
}

export const useGameStore = create<GameState>((set, get) => ({
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
  gwMySecret: null,
  gwMasks: {},
  imposterMyWord: null,
  cnMyKey: null,
  lobbyDrawing: [],

  setConnected: (connected) => set({ connected }),
  setRoom: (code, playerId) =>
    set({ code, playerId, gwMySecret: loadGwSecret(code) }),
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
  resetRoundLocal: () => {
    // Le secret "qui-est-ce" est par manche : on le purge entre les rounds
    // (nécessaire en mode multi-manches où chaque round rebat les grilles).
    const code = get().code;
    persistGwSecret(code, null);
    set({
      reveal: null,
      scoring: null,
      answeredPlayerIds: new Set(),
      eliminations: [],
      hostValidations: {},
      gwMasks: {},
      gwMySecret: null,
      imposterMyWord: null,
      cnMyKey: null,
    });
  },
  setHostValidation: (playerId, correct) =>
    set((s) => ({ hostValidations: { ...s.hostValidations, [playerId]: correct } })),
  setHostValidations: (v) =>
    set(() => {
      const next: Record<string, boolean> = {};
      for (const entry of v) next[entry.playerId] = entry.correct;
      return { hostValidations: next };
    }),
  setError: (lastError) => set({ lastError }),
  setGwMySecret: (secret) => {
    const code = get().code;
    persistGwSecret(code, secret);
    set({ gwMySecret: secret });
  },
  setGwMasks: (byTarget) =>
    set(() => {
      const next: Record<string, Set<string>> = {};
      for (const [tid, arr] of Object.entries(byTarget)) {
        next[tid] = new Set(arr);
      }
      return { gwMasks: next };
    }),
  setImposterYourWord: (payload) =>
    set({
      imposterMyWord: payload?.word ?? null,
    }),
  setCnMyKey: (key) => set({ cnMyKey: key }),
  setLobbyDrawing: (strokes) => set({ lobbyDrawing: strokes }),
  appendLobbyStroke: (stroke) =>
    set((s) => ({ lobbyDrawing: [...s.lobbyDrawing, stroke] })),
  clearLobbyDrawing: () => set({ lobbyDrawing: [] }),
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
      gwMySecret: null,
      gwMasks: {},
      imposterMyWord: null,
      cnMyKey: null,
      lobbyDrawing: [],
    }),
}));

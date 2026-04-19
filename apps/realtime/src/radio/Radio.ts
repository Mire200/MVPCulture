import { RADIO_TRACKS, type RadioTrack, type RadioStatePayload } from '@mvpc/shared';

/**
 * Serveur de radio globale synchronisée.
 *
 * - Shuffle initial, ordre FIFO ensuite (on reshuffle quand on arrive au bout).
 * - Chaque piste a un `startedAt` (epoch ms) qui sert de référence commune à
 *   tous les clients, qui peuvent alors calculer leur `currentTime` local.
 * - Auto-advance via setTimeout sur `duration`.
 * - Les clients peuvent demander l'état courant via `getState()` et écouter
 *   l'événement `onChange` pour re-broadcast à chaque changement de piste.
 */
export class Radio {
  private playlist: RadioTrack[];
  private index = 0;
  private currentStartedAt = 0;
  private timer: NodeJS.Timeout | null = null;
  private listeners = new Set<(state: RadioStatePayload) => void>();

  constructor(tracks: readonly RadioTrack[] = RADIO_TRACKS) {
    if (tracks.length === 0) {
      throw new Error('Radio: aucune piste disponible');
    }
    this.playlist = shuffle([...tracks]);
  }

  start(): void {
    if (this.currentStartedAt !== 0) return;
    this.playCurrent();
  }

  getState(): RadioStatePayload {
    const t = this.playlist[this.index]!;
    return {
      trackId: t.id,
      title: t.title,
      src: t.src,
      duration: t.duration,
      startedAt: this.currentStartedAt,
      serverTime: Date.now(),
    };
  }

  skip(): RadioStatePayload {
    this.advance();
    return this.getState();
  }

  onChange(cb: (state: RadioStatePayload) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private playCurrent(): void {
    const t = this.playlist[this.index]!;
    this.currentStartedAt = Date.now();

    if (this.timer) clearTimeout(this.timer);
    const ms = Math.max(500, Math.round(t.duration * 1000));
    this.timer = setTimeout(() => this.advance(), ms);

    const state = this.getState();
    for (const cb of this.listeners) cb(state);
  }

  private advance(): void {
    this.index += 1;
    if (this.index >= this.playlist.length) {
      // Reshuffle, en évitant de rejouer la même piste deux fois de suite si possible.
      const last = this.playlist[this.playlist.length - 1]!.id;
      this.playlist = shuffle([...this.playlist]);
      if (this.playlist.length > 1 && this.playlist[0]!.id === last) {
        [this.playlist[0], this.playlist[1]] = [this.playlist[1]!, this.playlist[0]!];
      }
      this.index = 0;
    }
    this.playCurrent();
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

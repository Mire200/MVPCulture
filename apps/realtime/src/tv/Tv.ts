import { TV_CLIPS, type TvClip, type TvStatePayload } from '@mvpc/shared';

/**
 * Serveur de télé globale synchronisée pour le lobby.
 *
 * - Playlist mélangée aléatoirement, puis reshuffle quand on arrive au bout
 *   (en évitant si possible de rejouer le même clip deux fois de suite).
 * - Chaque clip a un `startedAt` (epoch ms) qui sert de référence commune à
 *   tous les clients, qui peuvent alors calculer leur `currentTime` local.
 * - Auto-advance via setTimeout sur `duration`.
 * - Les clients peuvent demander l'état courant via `getState()` et écouter
 *   l'événement `onChange` pour re-broadcast à chaque changement de clip.
 *
 * NB : volontairement proche de Radio.ts, pour rester prévisible à maintenir.
 */
export class Tv {
  private playlist: TvClip[];
  private index = 0;
  private currentStartedAt = 0;
  private timer: NodeJS.Timeout | null = null;
  private listeners = new Set<(state: TvStatePayload) => void>();

  constructor(clips: readonly TvClip[] = TV_CLIPS) {
    if (clips.length === 0) {
      throw new Error('Tv: aucun clip disponible');
    }
    this.playlist = shuffle([...clips]);
  }

  start(): void {
    if (this.currentStartedAt !== 0) return;
    this.playCurrent();
  }

  getState(): TvStatePayload {
    const c = this.playlist[this.index]!;
    return {
      clipId: c.id,
      src: c.src,
      duration: c.duration,
      startedAt: this.currentStartedAt,
      serverTime: Date.now(),
    };
  }

  skip(): TvStatePayload {
    this.advance();
    return this.getState();
  }

  onChange(cb: (state: TvStatePayload) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private playCurrent(): void {
    const c = this.playlist[this.index]!;
    this.currentStartedAt = Date.now();

    if (this.timer) clearTimeout(this.timer);
    const ms = Math.max(500, Math.round(c.duration * 1000));
    this.timer = setTimeout(() => this.advance(), ms);

    const state = this.getState();
    for (const cb of this.listeners) cb(state);
  }

  private advance(): void {
    this.index += 1;
    if (this.index >= this.playlist.length) {
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

'use client';
// Moteur de sons synth basé sur Web Audio — léger, pas de fichiers audio.

type ToneOpts = {
  freq?: number;
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  attack?: number;
  freqEnd?: number | null;
  filter?: { type?: BiquadFilterType; freq?: number };
};

type NoiseOpts = {
  dur?: number;
  gain?: number;
  filterFreq?: number;
  filterType?: BiquadFilterType;
};

class Engine {
  ctx: AudioContext | null = null;
  enabled = true;

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        const Ctor = (window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) ||
          null;
        if (Ctor) this.ctx = new Ctor();
      } catch {
        /* noop */
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
  }

  private tone(opts: ToneOpts = {}) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const {
      freq = 440,
      type = 'sine',
      dur = 0.15,
      gain = 0.2,
      attack = 0.005,
      freqEnd = null,
      filter = null,
    } = opts;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type ?? 'lowpass';
      f.frequency.value = filter.freq ?? 1200;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(opts: NoiseOpts = {}) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const { dur = 0.2, gain = 0.15, filterFreq = 2000, filterType = 'bandpass' } = opts;
    const t0 = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = filterFreq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  click() { this.tone({ freq: 800, type: 'square', dur: 0.04, gain: 0.1 }); }
  pop() { this.tone({ freq: 520, type: 'sine', dur: 0.08, gain: 0.18, freqEnd: 880 }); }
  tick() { this.tone({ freq: 1200, type: 'square', dur: 0.03, gain: 0.06 }); }
  tickUrgent() { this.tone({ freq: 1800, type: 'square', dur: 0.04, gain: 0.14 }); }
  whoosh() { this.noise({ dur: 0.32, gain: 0.2, filterFreq: 1200, filterType: 'lowpass' }); }
  success() {
    this.tone({ freq: 523, type: 'triangle', dur: 0.1, gain: 0.18 });
    setTimeout(() => this.tone({ freq: 784, type: 'triangle', dur: 0.14, gain: 0.2 }), 80);
    setTimeout(() => this.tone({ freq: 1047, type: 'triangle', dur: 0.2, gain: 0.2 }), 180);
  }
  fail() { this.tone({ freq: 220, type: 'sawtooth', dur: 0.3, gain: 0.16, freqEnd: 80 }); }
  bigReveal() {
    this.noise({ dur: 0.6, gain: 0.22, filterFreq: 600, filterType: 'lowpass' });
    setTimeout(() => {
      this.tone({ freq: 220, type: 'sine', dur: 0.6, gain: 0.22 });
      this.tone({ freq: 330, type: 'sine', dur: 0.6, gain: 0.16 });
      this.tone({ freq: 440, type: 'sine', dur: 0.6, gain: 0.13 });
    }, 200);
  }
  countdown(n: number) {
    if (n <= 0) {
      this.tone({ freq: 880, type: 'triangle', dur: 0.5, gain: 0.28, freqEnd: 1320 });
      return;
    }
    this.tone({ freq: 440, type: 'triangle', dur: 0.14, gain: 0.18 });
  }
  eliminate() {
    this.tone({ freq: 180, type: 'sawtooth', dur: 0.18, gain: 0.2, freqEnd: 60 });
    setTimeout(() => this.noise({ dur: 0.2, gain: 0.14, filterFreq: 400, filterType: 'lowpass' }), 60);
  }
  fanfare() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) =>
      setTimeout(() => this.tone({ freq: f, type: 'triangle', dur: 0.35, gain: 0.22 }), i * 100),
    );
  }
}

export const mvpSound = new Engine();
if (typeof window !== 'undefined') {
  (window as unknown as { mvpSound?: Engine }).mvpSound = mvpSound;
}

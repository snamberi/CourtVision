/**
 * Courtside sound, synthesized with Web Audio (no audio files to download).
 * Created lazily after a user gesture, so nothing plays or allocates until sound is switched on.
 */
type Ctx = AudioContext;
export class CourtAudio {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastDribble = 0;

  get enabled() { return !!this.ctx && this.ctx.state === 'running'; }

  async enable(): Promise<boolean> {
    const Ctor: typeof AudioContext | undefined = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
    if (!Ctor) return false;
    if (!this.ctx) {
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(ctx.destination);
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
      // Crowd bed: looping noise shaped into a low murmur. Its level follows the game.
      const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
      const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 520; band.Q.value = .7;
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 1400;
      this.crowdGain = ctx.createGain(); this.crowdGain.gain.value = 0;
      src.connect(band).connect(low).connect(this.crowdGain).connect(this.master); src.start();
    }
    try { await this.ctx.resume(); } catch { return false; }
    return this.ctx.state === 'running';
  }
  async disable() { if (this.ctx && this.ctx.state === 'running') { try { await this.ctx.suspend(); } catch { /* already closed */ } } }
  private tap: MediaStreamAudioDestinationNode | null = null;
  /** A copy of the sound mix, so a recorded highlight reel carries the audio too. */
  stream(): MediaStream | null {
    if (!this.enabled || !this.ctx || !this.master) return null;
    if (!this.tap) { this.tap = this.ctx.createMediaStreamDestination(); this.master.connect(this.tap); }
    return this.tap.stream;
  }
  dispose() { void this.ctx?.close().catch(() => {}); this.ctx = null; }

  /** 0 = quiet arena, 1 = everyone on their feet. */
  crowd(level: number) {
    if (!this.enabled || !this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(0.05 + Math.max(0, Math.min(1, level)) * 0.32, this.ctx!.currentTime, 0.35);
  }
  dribble() {
    const ctx = this.ctx; if (!this.enabled || !ctx) return;
    const now = ctx.currentTime; if (now - this.lastDribble < 0.09) return; this.lastDribble = now;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, now); o.frequency.exponentialRampToValueAtTime(52, now + .09);
    g.gain.setValueAtTime(.55, now); g.gain.exponentialRampToValueAtTime(.001, now + .12);
    o.connect(g).connect(this.master!); o.start(now); o.stop(now + .13);
    this.burst(.035, 1800, 'bandpass', .12, 1.4);
  }
  swish() { this.burst(.32, 3200, 'highpass', .28, .9); }
  rim() {
    const ctx = this.ctx; if (!this.enabled || !ctx) return;
    const now = ctx.currentTime;
    for (const [f, v] of [[540, .22], [812, .14], [1290, .07]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(v, now); g.gain.exponentialRampToValueAtTime(.001, now + .45);
      o.connect(g).connect(this.master!); o.start(now); o.stop(now + .46);
    }
    this.burst(.05, 2600, 'bandpass', .3, 2);
  }
  whistle() {
    const ctx = this.ctx; if (!this.enabled || !ctx) return;
    const now = ctx.currentTime, o = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 2950; lfo.frequency.value = 38; depth.gain.value = 70;
    lfo.connect(depth).connect(o.frequency);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.12, now + .02); g.gain.setValueAtTime(.12, now + .32); g.gain.exponentialRampToValueAtTime(.001, now + .45);
    o.connect(g).connect(this.master!); o.start(now); lfo.start(now); o.stop(now + .46); lfo.stop(now + .46);
  }
  buzzer() {
    const ctx = this.ctx; if (!this.enabled || !ctx) return;
    const now = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 196; f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.2, now + .03); g.gain.setValueAtTime(.2, now + .95); g.gain.exponentialRampToValueAtTime(.001, now + 1.1);
    o.connect(f).connect(g).connect(this.master!); o.start(now); o.stop(now + 1.12);
  }
  /** Home crowd reaction. `loud` for a home basket or stop, soft murmur for the visitors. */
  cheer(loud: boolean) { this.burst(loud ? .5 : .14, loud ? 900 : 600, 'bandpass', loud ? 1.6 : .9, .6, true); }

  private burst(volume: number, freq: number, type: BiquadFilterType, seconds: number, q = 1, swell = false) {
    const ctx = this.ctx; if (!this.enabled || !ctx || !this.noise) return;
    const now = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise; src.loop = seconds > 1.9; f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (swell) { g.gain.setValueAtTime(.001, now); g.gain.exponentialRampToValueAtTime(volume, now + seconds * .3); }
    else g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(.001, now + seconds);
    src.connect(f).connect(g).connect(this.master!); src.start(now, Math.random() * 1.5); src.stop(now + seconds + .02);
  }
}

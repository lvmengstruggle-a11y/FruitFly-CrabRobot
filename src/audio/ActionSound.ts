/** Short synthesized cues for the crab's actions. No sample files. */
export class ActionSound {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stepSide = false;

  unlock() {
    const ctx = this.ensure();
    if (ctx?.state === 'suspended') void ctx.resume();
  }

  wake() {
    this.blip(220, 0.12, 0.05, 'sine');
    this.blip(330, 0.16, 0.04, 'sine', 0.06);
    this.blip(440, 0.2, 0.035, 'sine', 0.12);
  }

  jump(fromGround: boolean) {
    if (fromGround) {
      this.burst(0.09, 0.22, 160);
      this.blip(130, 0.14, 0.12, 'sine', 0, 0.45);
      this.blip(380, 0.08, 0.05, 'triangle', 0, 0.4);
      return;
    }
    this.burst(0.05, 0.1, 640);
    this.blip(540, 0.07, 0.045, 'square', 0, 0.62);
  }

  land(impact: number) {
    const hit = Math.max(0.35, Math.min(1, impact));
    this.burst(0.08 + hit * 0.06, 0.16 * hit, 220);
    this.blip(70 + hit * 30, 0.16, 0.1 * hit, 'sine', 0, 0.5);
  }

  haul() {
    this.burst(0.1, 0.08, 900);
    this.blip(240, 0.09, 0.04, 'triangle', 0, 1.4);
  }

  step() {
    this.stepSide = !this.stepSide;
    this.burst(0.035, 0.045, this.stepSide ? 480 : 320);
  }

  hold() {
    this.blip(160, 0.22, 0.04, 'sine', 0, 0.7);
  }

  score() {
    this.blip(988, 0.07, 0.055, 'sine', 0, 1.15);
    this.blip(1318, 0.12, 0.05, 'sine', 0.06, 1.2);
    this.blip(1568, 0.16, 0.035, 'triangle', 0.11);
    this.burst(0.06, 0.035, 2400);
  }

  die() {
    this.burst(0.28, 0.2, 240);
    this.blip(196, 0.4, 0.08, 'sawtooth', 0, 0.28);
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private blip(freq: number, dur: number, peak: number, type: OscillatorType, when = 0, slide = 1) {
    const ctx = this.live();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, peak: number, freq: number) {
    const ctx = this.live();
    if (!ctx || !this.master) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(peak, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private live() {
    if (!this.enabled) return null;
    const ctx = this.ensure();
    if (ctx?.state === 'suspended') return null;
    return ctx;
  }
}

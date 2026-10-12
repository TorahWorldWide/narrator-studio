import { STFT_BINS, STFT_H, STFT_N, Stft } from '../stft';
import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface DerevP { amount: number; rt60: number; depth: number }
const DEF: DerevP = { amount: 70, rt60: 0.6, depth: 12 };
const LATE_FRAMES = 5;           // late reverb starts ≈ 50 ms after the direct sound (5 hops of 10.7 ms)

/**
 * Late-reverberation suppression (Lebart et al. 2001): the late echo power in each bin is predicted from
 * the smoothed power LATE_FRAMES ago, decayed by exp(−2·δ·T) with δ = 3·ln10 / RT60, and subtracted
 * (power gain floored at −depth dB, 3-bin smoothing). Latency 2048.
 */
class DerevProc implements Processor<DerevP> {
  private sr: number; private stft: Stft; private p = { ...DEF };
  private ps = new Float64Array(STFT_BINS);
  private hist: Float64Array[] = Array.from({ length: LATE_FRAMES }, () => new Float64Array(STFT_BINS)); private hi = 0;
  private g = new Float64Array(STFT_BINS); private decay = 0; private floor2 = 0;
  constructor(sr: number) {
    this.sr = sr;
    this.stft = new Stft((re, im) => this.frame(re, im));
    this.setParams(DEF);
  }
  setParams(p: Partial<DerevP>) {
    this.p = { amount: num(p.amount, DEF.amount), rt60: Math.max(0.1, num(p.rt60, DEF.rt60)), depth: num(p.depth, DEF.depth) };
    const T = (LATE_FRAMES * STFT_H) / this.sr, delta = (3 * Math.LN10) / this.p.rt60;
    this.decay = Math.exp(-2 * delta * T);
    this.floor2 = Math.pow(10, -this.p.depth / 10);
  }
  private frame(re: Float64Array, im: Float64Array) {
    const a = this.p.amount / 100, old = this.hist[this.hi], ps = this.ps, g = this.g;
    for (let b = 0; b < STFT_BINS; b++) {
      const P = re[b] * re[b] + im[b] * im[b];
      const late = this.decay * old[b];
      const gg = 1 - (a * late) / Math.max(P, 1e-30);
      g[b] = gg < this.floor2 ? this.floor2 : gg > 1 ? 1 : gg;
      ps[b] = 0.5 * ps[b] + 0.5 * P;
    }
    old.set(ps); this.hi = (this.hi + 1) % LATE_FRAMES;    // the oldest slot now holds the newest smoothed power
    for (let b = 0; b < STFT_BINS; b++) {
      const s = (g[b > 0 ? b - 1 : 0] + g[b] + g[b < STFT_BINS - 1 ? b + 1 : b]) / 3;
      const k = Math.sqrt(s);
      re[b] *= k; im[b] *= k;
    }
  }
  process(x: Float32Array, y: Float32Array) { this.stft.process(x, y); }
  latency() { return STFT_N; }
  reset() { this.stft.reset(); this.ps.fill(0); this.hist.forEach((h) => h.fill(0)); this.hi = 0; }
}

export const dereverb: ModuleDef<DerevP> = {
  id: 'dereverb', he: 'הפחתת הד חדר', en: 'De-reverb',
  blurb: 'מקטין את תחושת החדר מסביב לקול. עוזר קצת, לא קסם',
  params: [
    { key: 'amount', he: 'כמות', en: 'Amount', min: 0, max: 100, def: 70, step: 1, unit: '%', scale: 'lin' },
    { key: 'rt60', he: 'אורך ההד', en: 'RT60', min: 0.2, max: 2, def: 0.6, step: 0.01, unit: 's', scale: 'log' },
    { key: 'depth', he: 'מקסימום הורדה', en: 'Depth', min: 0, max: 30, def: 12, step: 0.5, unit: 'dB', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new DerevProc(sr),
};

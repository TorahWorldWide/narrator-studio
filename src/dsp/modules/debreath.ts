import type { ModuleDef, Processor } from '../types';
import { dbToLin, num } from '../util';

interface BreathP { thresh: number; range: number; noisy: number; minLen: number }
const DEF: BreathP = { thresh: -35, range: 12, noisy: 0.08, minLen: 100 };
const HOP = 240, WIN = 480;           // 5 ms hops over 10 ms windows (48 kHz)
const LOOK_MS = 150;

/**
 * A 5 ms hop is a breath candidate when its 10 ms RMS is below `thresh` (quieter than speech) and its
 * zero-crossing rate is above `noisy` (noise-like, not voiced). Only runs of candidates at least `minLen`
 * long are lowered by `range` — short breathy letters (ה׳/ח׳) stay. 150 ms look-ahead (compensated).
 */
class BreathProc implements Processor<BreathP> {
  private sr: number; private L: number; private ring: Float32Array; private n = 0;
  private flags: Uint16Array; // run length (in hops) of candidates ending at each hop, ring of 64
  private hop = 0; private p = { ...DEF }; private floor = dbToLin(-12); private g = 1; private a: number;
  constructor(sr: number) {
    this.sr = sr; this.L = Math.round((LOOK_MS / 1000) * sr);
    this.ring = new Float32Array(1 << 14); this.flags = new Uint16Array(64);
    this.a = 1 - Math.exp(-1 / (0.01 * sr));
  }
  setParams(p: Partial<BreathP>) {
    this.p = { thresh: num(p.thresh, DEF.thresh), range: num(p.range, DEF.range), noisy: num(p.noisy, DEF.noisy), minLen: Math.min(LOOK_MS, num(p.minLen, DEF.minLen)) };
    this.floor = dbToLin(-this.p.range);
  }
  private analyse(end: number) {   // window ending at absolute sample `end`
    let s = 0, z = 0, prev = this.ring[(end - WIN) & 16383];
    for (let k = end - WIN + 1; k <= end; k++) { const v = this.ring[k & 16383]; s += v * v; if ((v >= 0) !== (prev >= 0)) z++; prev = v; }
    const lvl = 10 * Math.log10(s / WIN + 1e-20), zcr = z / WIN;
    const cand = lvl < this.p.thresh && lvl > -80 && zcr > this.p.noisy;
    const prevRun = this.flags[(this.hop - 1) & 63];
    this.flags[this.hop & 63] = cand ? Math.min(65535, prevRun + 1) : 0;
    this.hop++;
  }
  /** Is output hop `h` inside a candidate run of at least minHops (looking at the hops known so far)? */
  private breathAt(h: number) {
    const minHops = Math.ceil((this.p.minLen / 1000) * this.sr / HOP);
    if (h < 0 || this.flags[h & 63] === 0) return false;
    for (let k = h; k < this.hop && k <= h + minHops; k++) {
      const r = this.flags[k & 63];
      if (r === 0) return false;
      if (r >= minHops && r >= k - h + 1) return true;
    }
    return false;
  }
  process(x: Float32Array, y: Float32Array) {
    for (let i = 0; i < x.length; i++) {
      const n = this.n;
      this.ring[n & 16383] = x[i];
      if ((n + 1) % HOP === 0) this.analyse(n);
      const m = n - this.L;
      const out = m >= 0 ? this.ring[m & 16383] : 0;
      const h = Math.floor((m + 1) / HOP) - 1;            // hop whose window ends at or after m
      const target = m >= 0 && this.breathAt(Math.max(0, h + 1)) ? this.floor : 1;
      this.g += (target - this.g) * this.a;
      y[i] = this.g === 1 ? out : out * this.g;
      this.n++;
    }
  }
  latency() { return this.L; }
  reset() { this.ring.fill(0); this.flags.fill(0); this.n = 0; this.hop = 0; this.g = 1; }
}

export const debreath: ModuleDef<BreathP> = {
  id: 'debreath', he: 'מנמיך נשימות', en: 'De-breath',
  blurb: 'מזהה נשימות בין משפטים ומנמיך אותן',
  params: [
    { key: 'thresh', he: 'שקט מ-', en: 'Threshold', min: -60, max: -15, def: -35, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'range', he: 'כמה להנמיך', en: 'Range', min: 0, max: 40, def: 12, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'noisy', he: 'רחשיות', en: 'Noisiness', min: 0.02, max: 0.3, def: 0.08, step: 0.005, unit: '', scale: 'log' },
    { key: 'minLen', he: 'אורך מינימום', en: 'Min length', min: 30, max: 150, def: 100, step: 1, unit: 'ms', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new BreathProc(sr),
};

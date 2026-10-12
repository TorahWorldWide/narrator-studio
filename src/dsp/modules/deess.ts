import { Biquad, highpass, lowpass } from '../biquad';
import type { ModuleDef, Processor } from '../types';
import { num } from '../util';
import { CompCore } from './comp';

interface DeessP { freq: number; thresh: number; ratio: number; release: number }
const DEF: DeessP = { freq: 6000, thresh: -25, ratio: 4, release: 80 };
const Q = 0.7071;

/**
 * Linkwitz-Riley 4th-order split (two Butterworth biquads per band); the high band goes through
 * the compressor core (1 ms attack, hard knee); bands are summed back (flat magnitude).
 */
class DeessProc implements Processor<DeessP> {
  private sr: number; private key = '';
  private lp = [new Biquad(lowpass(48000, 6000, Q)), new Biquad(lowpass(48000, 6000, Q))];
  private hp = [new Biquad(highpass(48000, 6000, Q)), new Biquad(highpass(48000, 6000, Q))];
  private core: CompCore;
  private lo = new Float32Array(128); private hi = new Float32Array(128);
  constructor(sr: number) { this.sr = sr; this.core = new CompCore(sr); }
  get gr() { return this.core.gr; }
  setParams(p: Partial<DeessP>) {
    const f = num(p.freq, DEF.freq);
    this.core.set({ thresh: num(p.thresh, DEF.thresh), ratio: num(p.ratio, DEF.ratio), attack: 1, release: num(p.release, DEF.release), knee: 0 });
    const key = String(f);
    if (key === this.key) return;
    this.key = key;
    this.lp.forEach((b) => b.set(lowpass(this.sr, f, Q)));
    this.hp.forEach((b) => b.set(highpass(this.sr, f, Q)));
  }
  process(x: Float32Array, y: Float32Array) {
    if (this.lo.length !== x.length) { this.lo = new Float32Array(x.length); this.hi = new Float32Array(x.length); }
    const lo = this.lo, hi = this.hi;
    this.lp[0].process(x, lo); this.lp[1].process(lo, lo);
    this.hp[0].process(x, hi); this.hp[1].process(hi, hi);
    for (let i = 0; i < x.length; i++) { const h = hi[i]; y[i] = lo[i] + h * this.core.step(h); }
  }
  latency() { return 0; }
  reset() { [...this.lp, ...this.hp].forEach((b) => b.reset()); this.core.reset(); }
}

export const deess: ModuleDef<DeessP> = {
  id: 'deess', he: 'דה-אסר', en: 'De-esser',
  blurb: 'מרכך ש׳ ו-ס׳ חדות בלי לגעת בשאר הקול',
  params: [
    { key: 'freq', he: 'תדר', en: 'Freq', min: 3000, max: 10000, def: 6000, step: 10, unit: 'Hz', scale: 'log' },
    { key: 'thresh', he: 'סף', en: 'Threshold', min: -50, max: 0, def: -25, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'ratio', he: 'יחס', en: 'Ratio', min: 1, max: 10, def: 4, step: 0.1, unit: 'x', scale: 'log' },
    { key: 'release', he: 'שחרור', en: 'Release', min: 20, max: 300, def: 80, step: 1, unit: 'ms', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new DeessProc(sr),
};

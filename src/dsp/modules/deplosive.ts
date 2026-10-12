import { Biquad, highpass, lowpass } from '../biquad';
import type { ModuleDef, Processor } from '../types';
import { num } from '../util';
import { CompCore } from './comp';

interface DeplP { freq: number; thresh: number; ratio: number; release: number }
const DEF: DeplP = { freq: 150, thresh: -24, ratio: 4, release: 60 };
const Q = 0.7071;

/** LR4 split; only the low band (the "boom" of פ׳/ב׳) goes through a fast compressor; bands summed back. */
class DeplProc implements Processor<DeplP> {
  private sr: number; private f = NaN; private core: CompCore;
  private lp = [new Biquad(lowpass(48000, 150, Q)), new Biquad(lowpass(48000, 150, Q))];
  private hp = [new Biquad(highpass(48000, 150, Q)), new Biquad(highpass(48000, 150, Q))];
  private lo = new Float32Array(128); private hi = new Float32Array(128);
  constructor(sr: number) { this.sr = sr; this.core = new CompCore(sr); }
  get gr() { return this.core.gr; }
  setParams(p: Partial<DeplP>) {
    const f = num(p.freq, DEF.freq);
    this.core.set({ thresh: num(p.thresh, DEF.thresh), ratio: num(p.ratio, DEF.ratio), attack: 0.5, release: num(p.release, DEF.release), knee: 0 });
    if (f !== this.f) { this.f = f; this.lp.forEach((b) => b.set(lowpass(this.sr, f, Q))); this.hp.forEach((b) => b.set(highpass(this.sr, f, Q))); }
  }
  process(x: Float32Array, y: Float32Array) {
    if (this.lo.length !== x.length) { this.lo = new Float32Array(x.length); this.hi = new Float32Array(x.length); }
    const lo = this.lo, hi = this.hi;
    this.lp[0].process(x, lo); this.lp[1].process(lo, lo);
    this.hp[0].process(x, hi); this.hp[1].process(hi, hi);
    for (let i = 0; i < x.length; i++) { const l = lo[i]; y[i] = hi[i] + l * this.core.step(l); }
  }
  latency() { return 0; }
  reset() { [...this.lp, ...this.hp].forEach((b) => b.reset()); this.core.reset(); }
}

export const deplosive: ModuleDef<DeplP> = {
  id: 'deplosive', he: 'מסנן פיצוצים', en: 'De-plosive',
  blurb: 'מרכך את מכת האוויר של פ׳ ו-ב׳ שנשמעת כמו "בום"',
  params: [
    { key: 'freq', he: 'מתחת לתדר', en: 'Freq', min: 60, max: 300, def: 150, step: 1, unit: 'Hz', scale: 'log' },
    { key: 'thresh', he: 'סף', en: 'Threshold', min: -50, max: 0, def: -24, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'ratio', he: 'יחס', en: 'Ratio', min: 1, max: 20, def: 4, step: 0.1, unit: 'x', scale: 'log' },
    { key: 'release', he: 'שחרור', en: 'Release', min: 10, max: 300, def: 60, step: 1, unit: 'ms', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new DeplProc(sr),
};

import { Biquad, highpass, lowpass } from '../biquad';
import type { ModuleDef, Processor } from '../types';
import { Smoother, dbToLin, num } from '../util';
import { CompCore } from './comp';

interface MbP { f1: number; f2: number; tl: number; rl: number; tm: number; rm: number; th: number; rh: number; attack: number; release: number; makeup: number }
const DEF: MbP = { f1: 250, f2: 4000, tl: -24, rl: 2, tm: -24, rm: 2, th: -24, rh: 2, attack: 10, release: 120, makeup: 0 };
const Q = 0.7071;

/** LR4 two-pass bi-quad crossover pair (4 Butterworth sections). */
class LR4 {
  lp = [new Biquad(lowpass(48000, 1000, Q)), new Biquad(lowpass(48000, 1000, Q))];
  hp = [new Biquad(highpass(48000, 1000, Q)), new Biquad(highpass(48000, 1000, Q))];
  set(sr: number, f: number) { this.lp.forEach((b) => b.set(lowpass(sr, f, Q))); this.hp.forEach((b) => b.set(highpass(sr, f, Q))); }
  split(x: Float32Array, lo: Float32Array, hi: Float32Array) {
    this.lp[0].process(x, lo); this.lp[1].process(lo, lo);
    this.hp[0].process(x, hi); this.hp[1].process(hi, hi);
  }
  reset() { [...this.lp, ...this.hp].forEach((b) => b.reset()); }
}

/** 3 bands: low = LP(f1) then the f2 crossover's allpass (so the sum stays flat); mid/high split at f2. */
class MbProc implements Processor<MbP> {
  private sr: number; private x1 = new LR4(); private x2 = new LR4(); private ap = new LR4();
  private cores: CompCore[]; private mk: Smoother; private key = '';
  private lo = new Float32Array(128); private rest = new Float32Array(128); private mid = new Float32Array(128);
  private hi = new Float32Array(128); private a = new Float32Array(128); private b = new Float32Array(128);
  constructor(sr: number) { this.sr = sr; this.cores = [new CompCore(sr), new CompCore(sr), new CompCore(sr)]; this.mk = new Smoother(sr); }
  get gr() { return Math.max(...this.cores.map((c) => c.gr)); }
  setParams(p: Partial<MbP>) {
    const v = (k: keyof MbP) => num(p[k], DEF[k]);
    const f1 = v('f1'), f2 = Math.max(v('f2'), f1 * 1.5), key = `${f1}|${f2}`;
    if (key !== this.key) { this.key = key; this.x1.set(this.sr, f1); this.x2.set(this.sr, f2); this.ap.set(this.sr, f2); }
    const shared = { attack: v('attack'), release: v('release'), knee: 6 };
    this.cores[0].set({ ...shared, thresh: v('tl'), ratio: v('rl') });
    this.cores[1].set({ ...shared, thresh: v('tm'), ratio: v('rm') });
    this.cores[2].set({ ...shared, thresh: v('th'), ratio: v('rh') });
    this.mk.set(dbToLin(v('makeup')));
  }
  process(x: Float32Array, y: Float32Array) {
    const n = x.length;
    if (this.lo.length !== n) { this.lo = new Float32Array(n); this.rest = new Float32Array(n); this.mid = new Float32Array(n); this.hi = new Float32Array(n); this.a = new Float32Array(n); this.b = new Float32Array(n); }
    const { lo, rest, mid, hi, a, b } = this;
    this.x1.split(x, lo, rest);
    this.ap.split(lo, a, b);                       // allpass(f2) = LP + HP of the low band
    for (let i = 0; i < n; i++) lo[i] = a[i] + b[i];
    this.x2.split(rest, mid, hi);
    const [cl, cm, ch] = this.cores;
    for (let i = 0; i < n; i++) {
      const l = lo[i], m = mid[i], h = hi[i];
      y[i] = (l * cl.step(l) + m * cm.step(m) + h * ch.step(h)) * this.mk.next();
    }
  }
  latency() { return 0; }
  reset() { this.x1.reset(); this.x2.reset(); this.ap.reset(); this.cores.forEach((c) => c.reset()); this.mk.snap(); }
}

export const mbcomp: ModuleDef<MbP> = {
  id: 'mbcomp', he: 'קומפרסור 3 פסים', en: 'Multiband comp',
  blurb: 'שולט בנפרד בבס, באמצע ובגבוהים',
  params: [
    { key: 'f1', he: 'בס/אמצע', en: 'Low/Mid', min: 60, max: 1000, def: 250, step: 1, unit: 'Hz', scale: 'log' },
    { key: 'f2', he: 'אמצע/גבוה', en: 'Mid/High', min: 1000, max: 10000, def: 4000, step: 10, unit: 'Hz', scale: 'log' },
    { key: 'tl', he: 'סף בס', en: 'Low thr', min: -60, max: 0, def: -24, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'rl', he: 'יחס בס', en: 'Low ratio', min: 1, max: 20, def: 2, step: 0.1, unit: 'x', scale: 'log' },
    { key: 'tm', he: 'סף אמצע', en: 'Mid thr', min: -60, max: 0, def: -24, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'rm', he: 'יחס אמצע', en: 'Mid ratio', min: 1, max: 20, def: 2, step: 0.1, unit: 'x', scale: 'log' },
    { key: 'th', he: 'סף גבוה', en: 'High thr', min: -60, max: 0, def: -24, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'rh', he: 'יחס גבוה', en: 'High ratio', min: 1, max: 20, def: 2, step: 0.1, unit: 'x', scale: 'log' },
    { key: 'attack', he: 'תגובה', en: 'Attack', min: 0.1, max: 100, def: 10, step: 0.1, unit: 'ms', scale: 'log' },
    { key: 'release', he: 'שחרור', en: 'Release', min: 10, max: 1000, def: 120, step: 1, unit: 'ms', scale: 'log' },
    { key: 'makeup', he: 'הגברה', en: 'Makeup', min: -12, max: 24, def: 0, step: 0.1, unit: 'dB', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new MbProc(sr),
};

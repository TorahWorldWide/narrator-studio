import { BUTTER_Q, Cascade, highpass } from '../biquad';
import type { ModuleDef, Processor } from '../types';
import { Smoother, dbToLin, num } from '../util';

interface ExciterP { freq: number; drive: number; mix: number }
const DEF: ExciterP = { freq: 3000, drive: 12, mix: 20 };

/** High band (HP) → tanh harmonics → HP again (keeps them above freq) → added to the dry signal. */
class ExciterProc implements Processor<ExciterP> {
  private sr: number; private pre = new Cascade(); private post = new Cascade(); private f = NaN;
  private g = 1; private mix: Smoother; private h = new Float32Array(128);
  constructor(sr: number) { this.sr = sr; this.mix = new Smoother(sr); }
  setParams(p: Partial<ExciterP>) {
    const f = num(p.freq, DEF.freq);
    if (f !== this.f) {
      this.f = f;
      const cs = BUTTER_Q[2].map((q) => highpass(this.sr, f, q));
      this.pre.setAll(cs); this.post.setAll(cs);
    }
    this.g = dbToLin(num(p.drive, DEF.drive));
    this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100)));
  }
  process(x: Float32Array, y: Float32Array) {
    if (this.h.length !== x.length) this.h = new Float32Array(x.length);
    const h = this.h;
    this.pre.process(x, h);
    for (let i = 0; i < h.length; i++) h[i] = Math.tanh(h[i] * this.g) / this.g;
    this.post.process(h, h);
    for (let i = 0; i < x.length; i++) { const m = this.mix.next(); y[i] = m === 0 ? x[i] : x[i] + m * h[i]; }
  }
  latency() { return 0; }
  reset() { this.pre.reset(); this.post.reset(); this.mix.snap(); }
}

export const exciter: ModuleDef<ExciterP> = {
  id: 'exciter', he: 'אקסייטר', en: 'Exciter',
  blurb: 'מוסיף אוויר וברק לקול דרך הרמוניות עדינות בגבוהים',
  params: [
    { key: 'freq', he: 'מעל תדר', en: 'Freq', min: 1000, max: 10000, def: 3000, step: 10, unit: 'Hz', scale: 'log' },
    { key: 'drive', he: 'דחיפה', en: 'Drive', min: 0, max: 30, def: 12, step: 0.1, unit: 'dB', scale: 'lin' },
    { key: 'mix', he: 'מינון', en: 'Mix', min: 0, max: 100, def: 20, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new ExciterProc(sr),
};

import type { ModuleDef, Processor } from '../types';
import { Smoother, dbToLin, num } from '../util';

interface SatP { drive: number; mix: number }
const DEF: SatP = { drive: 6, mix: 50 };

/** y = tanh(x·g)/tanh(g) soft clip, dry/wet mix (mix 0 is an exact pass-through). */
class SatProc implements Processor<SatP> {
  private g = 1; private norm = 1 / Math.tanh(1); private mix: Smoother;
  constructor(sr: number) { this.mix = new Smoother(sr); }
  setParams(p: Partial<SatP>) {
    this.g = dbToLin(num(p.drive, DEF.drive));
    this.norm = 1 / Math.tanh(this.g);
    this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100)));
  }
  process(x: Float32Array, y: Float32Array) {
    const g = this.g, nrm = this.norm;
    for (let i = 0; i < x.length; i++) {
      const v = x[i], m = this.mix.next();
      y[i] = m === 0 ? v : v + m * (Math.tanh(v * g) * nrm - v);
    }
  }
  latency() { return 0; }
  reset() { this.mix.snap(); }
}

export const sat: ModuleDef<SatP> = {
  id: 'sat', he: 'חום/סטורציה', en: 'Saturation',
  blurb: 'מוסיף חום ועיגול לקול, כמו מגבר טייפ',
  params: [
    { key: 'drive', he: 'דחיפה', en: 'Drive', min: 0, max: 24, def: 6, step: 0.1, unit: 'dB', scale: 'lin' },
    { key: 'mix', he: 'מינון', en: 'Mix', min: 0, max: 100, def: 50, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new SatProc(sr),
};

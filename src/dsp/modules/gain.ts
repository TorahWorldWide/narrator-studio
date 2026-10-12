import type { ModuleDef, Processor } from '../types';
import { Smoother, dbToLin, num } from '../util';

interface GainP { gain: number }

class GainProc implements Processor<GainP> {
  private g: Smoother;
  constructor(sr: number) { this.g = new Smoother(sr); }
  setParams(p: Partial<GainP>) { this.g.set(dbToLin(num(p.gain, 0))); }
  process(x: Float32Array, y: Float32Array) {
    for (let i = 0; i < x.length; i++) y[i] = x[i] * this.g.next();
  }
  latency() { return 0; }
  reset() { this.g.snap(); }
}

export const gain: ModuleDef<GainP> = {
  id: 'gain', he: 'עוצמה', en: 'Gain',
  blurb: 'מגביר או מנמיך את כל ההקלטה',
  params: [{ key: 'gain', he: 'עוצמה', en: 'Gain', min: -24, max: 24, def: 0, step: 0.1, unit: 'dB', scale: 'lin' }],
  defaults: () => ({ gain: 0 }),
  create: (sr) => new GainProc(sr),
};

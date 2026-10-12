import type { ModuleDef, Processor } from '../types';
import { Smoother, num } from '../util';

interface TremP { rate: number; depth: number }
const DEF: TremP = { rate: 6, depth: 50 };

/** Amplitude LFO: gain = 1 − depth·(½ − ½cos 2πft). depth 0 is an exact pass-through. */
class TremProc implements Processor<TremP> {
  private sr: number; private rate = DEF.rate; private depth: Smoother; private ph = 0;
  constructor(sr: number) { this.sr = sr; this.depth = new Smoother(sr); }
  setParams(p: Partial<TremP>) {
    this.rate = num(p.rate, DEF.rate);
    this.depth.set(Math.min(1, Math.max(0, num(p.depth, DEF.depth) / 100)));
  }
  process(x: Float32Array, y: Float32Array) {
    const inc = this.rate / this.sr;
    for (let i = 0; i < x.length; i++) {
      const d = this.depth.next();
      y[i] = d === 0 ? x[i] : x[i] * (1 - d * (0.5 - 0.5 * Math.cos(2 * Math.PI * this.ph)));
      this.ph += inc; if (this.ph >= 1) this.ph -= 1;
    }
  }
  latency() { return 0; }
  reset() { this.ph = 0; this.depth.snap(); }
}

export const tremolo: ModuleDef<TremP> = {
  id: 'tremolo', he: 'טרמולו', en: 'Tremolo',
  blurb: 'עוצמה שפועמת מהר, כמו רעד',
  params: [
    { key: 'rate', he: 'מהירות', en: 'Rate', min: 0.5, max: 20, def: 6, step: 0.1, unit: 'Hz', scale: 'log' },
    { key: 'depth', he: 'עומק', en: 'Depth', min: 0, max: 100, def: 50, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new TremProc(sr),
};

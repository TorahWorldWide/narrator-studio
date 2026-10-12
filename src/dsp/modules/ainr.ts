import { Rnnoise, RN_FRAME } from '../rnnoise';
import type { ModuleDef, Processor } from '../types';
import { Smoother, num } from '../util';

interface AinrP { mix: number }
const DEF: AinrP = { mix: 100 };
/** 480 samples of frame buffering + RNNoise's own one-frame delay (measured: 480 in the speech band). */
const LAT = 2 * RN_FRAME;

/** RNNoise (xiph) neural noise suppression, 48 kHz, 10 ms frames; dry is delayed to match for the mix. */
class AinrProc implements Processor<AinrP> {
  private rn = new Rnnoise(); private inF = new Float32Array(RN_FRAME); private outF = new Float32Array(RN_FRAME);
  private fill = 0; private dry = new Float32Array(LAT); private dw = 0; private mix: Smoother;
  constructor(sr: number) { this.mix = new Smoother(sr); }
  setParams(p: Partial<AinrP>) { this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100))); }
  process(x: Float32Array, y: Float32Array) {
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      const d = this.dry[this.dw]; this.dry[this.dw] = v; if (++this.dw === LAT) this.dw = 0;   // x[n − LAT]
      const wet = this.outF[this.fill];                // frame emitted one frame after it was filled
      this.inF[this.fill] = v;
      if (++this.fill === RN_FRAME) { this.fill = 0; this.rn.frame(this.inF, this.outF); }
      const m = this.mix.next();
      y[i] = m === 0 ? d : d + m * (wet - d);
    }
  }
  latency() { return LAT; }
  reset() { this.rn = new Rnnoise(); this.inF.fill(0); this.outF.fill(0); this.fill = 0; this.dry.fill(0); this.dw = 0; this.mix.snap(); }
}

export const ainr: ModuleDef<AinrP> = {
  id: 'ainr', he: 'הפחתת רעש AI', en: 'AI denoise (RNNoise)',
  blurb: 'בינה מלאכותית קטנה שמפרידה בין הקול לרעש',
  params: [{ key: 'mix', he: 'עוצמת ניקוי', en: 'Amount', min: 0, max: 100, def: 100, step: 1, unit: '%', scale: 'lin' }],
  defaults: () => ({ ...DEF }),
  create: (sr) => new AinrProc(sr),
};

import type { ModuleDef, Processor } from '../types';
import { Smoother, num } from '../util';

interface RobotP { freq: number; metal: number; mix: number }
const DEF: RobotP = { freq: 60, metal: 40, mix: 100 };

/** Ring modulation with a sine carrier (the classic robot/"Dalek" voice) into a short metallic comb (3 ms). */
class RobotProc implements Processor<RobotP> {
  private sr: number; private f = DEF.freq; private fb = 0.4; private mix: Smoother; private ph = 0;
  private buf: Float32Array; private w = 0; private D: number;
  constructor(sr: number) {
    this.sr = sr; this.mix = new Smoother(sr);
    this.D = Math.round(0.003 * sr); this.buf = new Float32Array(this.D);
  }
  setParams(p: Partial<RobotP>) {
    this.f = num(p.freq, DEF.freq);
    this.fb = Math.min(0.9, Math.max(0, num(p.metal, DEF.metal) / 100));
    this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100)));
  }
  process(x: Float32Array, y: Float32Array) {
    const inc = this.f / this.sr, buf = this.buf;
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      const ring = v * Math.sin(2 * Math.PI * this.ph) * Math.SQRT2;
      this.ph += inc; if (this.ph >= 1) this.ph -= 1;
      const c = ring + this.fb * buf[this.w];
      buf[this.w] = c; if (++this.w === this.D) this.w = 0;
      const wet = c * (1 - this.fb);
      const m = this.mix.next();
      y[i] = m === 0 ? v : v + m * (wet - v);
    }
  }
  latency() { return 0; }
  reset() { this.buf.fill(0); this.w = 0; this.ph = 0; this.mix.snap(); }
}

export const robot: ModuleDef<RobotP> = {
  id: 'robot', he: 'קול רובוטי', en: 'Robot',
  blurb: 'הופך את הקול לרובוט מתכתי',
  params: [
    { key: 'freq', he: 'תדר רובוט', en: 'Freq', min: 20, max: 400, def: 60, step: 1, unit: 'Hz', scale: 'log' },
    { key: 'metal', he: 'מתכתיות', en: 'Metal', min: 0, max: 90, def: 40, step: 1, unit: '%', scale: 'lin' },
    { key: 'mix', he: 'מינון', en: 'Mix', min: 0, max: 100, def: 100, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new RobotProc(sr),
};

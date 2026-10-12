import type { ModuleDef, Processor } from '../types';
import { Smoother, num } from '../util';

/** type: 0 phaser (6 swept first-order allpasses), 1 flanger (swept 0.5–5 ms delay); both with feedback. */
interface PhaserP { type: number; rate: number; depth: number; feedback: number; mix: number }
const DEF: PhaserP = { type: 0, rate: 0.5, depth: 70, feedback: 40, mix: 50 };
const STAGES = 6;

class PhaserProc implements Processor<PhaserP> {
  private sr: number; private type = 0; private rate = DEF.rate; private depth = 0.7; private fb = 0.4; private mix: Smoother;
  private ph = 0; private z = new Float64Array(STAGES); private last = 0;
  private buf: Float32Array; private w = 0;
  constructor(sr: number) { this.sr = sr; this.mix = new Smoother(sr); this.buf = new Float32Array(Math.ceil(0.006 * sr) + 2); }
  setParams(p: Partial<PhaserP>) {
    this.type = Math.round(num(p.type, DEF.type)) === 1 ? 1 : 0;
    this.rate = num(p.rate, DEF.rate);
    this.depth = Math.min(1, Math.max(0, num(p.depth, DEF.depth) / 100));
    this.fb = Math.min(0.9, Math.max(0, num(p.feedback, DEF.feedback) / 100));
    this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100)));
  }
  process(x: Float32Array, y: Float32Array) {
    const inc = this.rate / this.sr, buf = this.buf, L = buf.length;
    for (let i = 0; i < x.length; i++) {
      const v = x[i], lfo = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.ph);
      let wet: number;
      if (this.type === 0) {
        const f = 200 * Math.pow(1 + 9 * this.depth, lfo);           // 200 Hz … 2 kHz at full depth
        const t = Math.tan((Math.PI * f) / this.sr), a = (t - 1) / (t + 1);
        let s = v + this.fb * this.last;
        for (let k = 0; k < STAGES; k++) { const o = a * s + this.z[k]; this.z[k] = s - a * o; s = o; }
        this.last = s; wet = s;
      } else {
        const d = (0.0005 + 0.0045 * this.depth * lfo) * this.sr;
        let r = this.w - d; if (r < 0) r += L;
        const i0 = Math.floor(r), f = r - i0, i1 = i0 + 1 === L ? 0 : i0 + 1;
        wet = buf[i0] + (buf[i1] - buf[i0]) * f;
        buf[this.w] = v + this.fb * wet;
        if (++this.w === L) this.w = 0;
      }
      this.ph += inc; if (this.ph >= 1) this.ph -= 1;
      const m = this.mix.next();
      y[i] = m === 0 ? v : v + m * (wet - v);
    }
  }
  latency() { return 0; }
  reset() { this.z.fill(0); this.last = 0; this.buf.fill(0); this.w = 0; this.ph = 0; this.mix.snap(); }
}

export const PHASER_TYPES = ['פייזר', 'פלנג׳ר'];

export const phaser: ModuleDef<PhaserP> = {
  id: 'phaser', he: 'פייזר/פלנג׳ר', en: 'Phaser/Flanger',
  blurb: '"סחרור" חללי שזז — פייזר רך או פלנג׳ר מתכתי',
  params: [
    { key: 'type', he: 'סוג', en: 'Type', min: 0, max: 1, def: 0, step: 1, unit: '', scale: 'lin' },
    { key: 'rate', he: 'מהירות', en: 'Rate', min: 0.05, max: 5, def: 0.5, step: 0.01, unit: 'Hz', scale: 'log' },
    { key: 'depth', he: 'עומק', en: 'Depth', min: 0, max: 100, def: 70, step: 1, unit: '%', scale: 'lin' },
    { key: 'feedback', he: 'הזנה חוזרת', en: 'Feedback', min: 0, max: 90, def: 40, step: 1, unit: '%', scale: 'lin' },
    { key: 'mix', he: 'מינון', en: 'Mix', min: 0, max: 100, def: 50, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new PhaserProc(sr),
};

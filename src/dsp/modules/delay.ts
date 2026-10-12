import type { ModuleDef, Processor } from '../types';
import { Smoother, num } from '../util';

interface DelayP { time: number; feedback: number; mix: number }
const DEF: DelayP = { time: 250, feedback: 30, mix: 20 };

/** Delay line with feedback, dry/wet crossfade (mix 0 is an exact pass-through). */
class DelayProc implements Processor<DelayP> {
  private buf: Float32Array; private w = 0; private d = 1; private fb: Smoother; private mix: Smoother; private sr: number;
  constructor(sr: number) {
    this.sr = sr; this.buf = new Float32Array(Math.ceil(sr * 1.05) + 1);
    this.fb = new Smoother(sr); this.mix = new Smoother(sr);
  }
  setParams(p: Partial<DelayP>) {
    this.d = Math.max(1, Math.min(this.buf.length - 1, Math.round((num(p.time, DEF.time) / 1000) * this.sr)));
    this.fb.set(Math.min(0.9, Math.max(0, num(p.feedback, DEF.feedback) / 100)));
    this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100)));
  }
  process(x: Float32Array, y: Float32Array) {
    const buf = this.buf, L = buf.length;
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      let r = this.w - this.d; if (r < 0) r += L;
      const wet = buf[r];
      buf[this.w] = v + wet * this.fb.next();
      if (++this.w === L) this.w = 0;
      const m = this.mix.next();
      y[i] = m === 0 ? v : v + m * (wet - v);
    }
  }
  latency() { return 0; }
  reset() { this.buf.fill(0); this.w = 0; this.fb.snap(); this.mix.snap(); }
}

export const delay: ModuleDef<DelayP> = {
  id: 'delay', he: 'הד', en: 'Delay',
  blurb: 'חזרה של הקול אחרי זמן קצר, כמו הד בהרים',
  params: [
    { key: 'time', he: 'זמן', en: 'Time', min: 20, max: 1000, def: 250, step: 1, unit: 'ms', scale: 'log' },
    { key: 'feedback', he: 'חזרות', en: 'Feedback', min: 0, max: 90, def: 30, step: 1, unit: '%', scale: 'lin' },
    { key: 'mix', he: 'מינון', en: 'Mix', min: 0, max: 100, def: 20, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new DelayProc(sr),
};

import type { ModuleDef, Processor } from '../types';
import { Smoother, num } from '../util';

interface ChorusP { rate: number; depth: number; voices: number; mix: number }
const DEF: ChorusP = { rate: 0.8, depth: 3, voices: 3, mix: 50 };
const BASE_MS = 15;

/** 1–4 voices reading a delay line at 15 ms ± depth, each with its own LFO phase; dry/wet crossfade. */
class ChorusProc implements Processor<ChorusP> {
  private buf: Float32Array; private w = 0; private ph = 0;
  private rate = DEF.rate; private depth = 0; private voices = 3; private mix: Smoother; private sr: number;
  constructor(sr: number) { this.sr = sr; this.buf = new Float32Array(Math.ceil(0.06 * sr) + 2); this.mix = new Smoother(sr); }
  setParams(p: Partial<ChorusP>) {
    this.rate = num(p.rate, DEF.rate);
    this.depth = (num(p.depth, DEF.depth) / 1000) * this.sr;
    this.voices = Math.max(1, Math.min(4, Math.round(num(p.voices, DEF.voices))));
    this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100)));
  }
  process(x: Float32Array, y: Float32Array) {
    const buf = this.buf, L = buf.length, base = (BASE_MS / 1000) * this.sr, inc = this.rate / this.sr;
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      buf[this.w] = v;
      let wet = 0;
      for (let k = 0; k < this.voices; k++) {
        const d = base + this.depth * Math.sin(2 * Math.PI * (this.ph + k / this.voices));
        let r = this.w - d; if (r < 0) r += L;
        const i0 = Math.floor(r), f = r - i0, i1 = i0 + 1 === L ? 0 : i0 + 1;
        wet += buf[i0] + (buf[i1] - buf[i0]) * f;
      }
      wet /= this.voices;
      if (++this.w === L) this.w = 0;
      this.ph += inc; if (this.ph >= 1) this.ph -= 1;
      const m = this.mix.next();
      y[i] = m === 0 ? v : v + m * (wet - v);
    }
  }
  latency() { return 0; }
  reset() { this.buf.fill(0); this.w = 0; this.ph = 0; this.mix.snap(); }
}

export const chorus: ModuleDef<ChorusP> = {
  id: 'chorus', he: 'כורוס', en: 'Chorus',
  blurb: 'מכפיל את הקול לכמה קולות קרובים, כמו מקהלה קטנה',
  params: [
    { key: 'rate', he: 'מהירות', en: 'Rate', min: 0.05, max: 5, def: 0.8, step: 0.01, unit: 'Hz', scale: 'log' },
    { key: 'depth', he: 'עומק', en: 'Depth', min: 0.1, max: 10, def: 3, step: 0.1, unit: 'ms', scale: 'log' },
    { key: 'voices', he: 'קולות', en: 'Voices', min: 1, max: 4, def: 3, step: 1, unit: '', scale: 'lin' },
    { key: 'mix', he: 'מינון', en: 'Mix', min: 0, max: 100, def: 50, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new ChorusProc(sr),
};

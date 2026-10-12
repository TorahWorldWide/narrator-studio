import type { ModuleDef, Processor } from '../types';
import { Smoother, num } from '../util';

interface RevP { size: number; damp: number; mix: number }
const DEF: RevP = { size: 30, damp: 50, mix: 15 };

// Freeverb (Jezar) tunings at 44.1 kHz, scaled to the running rate.
const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
const FIXED_GAIN = 0.015, SCALE_WET = 3, SCALE_DAMP = 0.4, SCALE_ROOM = 0.28, OFFSET_ROOM = 0.7;

class Comb {
  buf: Float32Array; i = 0; store = 0;
  constructor(n: number) { this.buf = new Float32Array(n); }
  step(x: number, fb: number, d1: number, d2: number) {
    const out = this.buf[this.i];
    this.store = out * d2 + this.store * d1;
    this.buf[this.i] = x + this.store * fb;
    if (++this.i === this.buf.length) this.i = 0;
    return out;
  }
}
class Allpass {
  buf: Float32Array; i = 0;
  constructor(n: number) { this.buf = new Float32Array(n); }
  step(x: number) {
    const b = this.buf[this.i], out = b - x;
    this.buf[this.i] = x + b * 0.5;
    if (++this.i === this.buf.length) this.i = 0;
    return out;
  }
}

/** Mono Freeverb: 8 parallel lowpass-feedback combs → 4 series allpasses; dry/wet crossfade. */
class RevProc implements Processor<RevP> {
  private combs: Comb[]; private aps: Allpass[];
  private fb = 0.84; private d1 = 0.2; private d2 = 0.8; private mix: Smoother;
  constructor(sr: number) {
    const k = sr / 44100;
    this.combs = COMBS.map((n) => new Comb(Math.round(n * k)));
    this.aps = ALLPASSES.map((n) => new Allpass(Math.round(n * k)));
    this.mix = new Smoother(sr);
  }
  setParams(p: Partial<RevP>) {
    this.fb = (num(p.size, DEF.size) / 100) * SCALE_ROOM + OFFSET_ROOM;
    this.d1 = (num(p.damp, DEF.damp) / 100) * SCALE_DAMP; this.d2 = 1 - this.d1;
    this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100)));
  }
  process(x: Float32Array, y: Float32Array) {
    const { combs, aps, fb, d1, d2 } = this;
    for (let i = 0; i < x.length; i++) {
      const v = x[i], inp = v * FIXED_GAIN;
      let s = 0;
      for (let c = 0; c < combs.length; c++) s += combs[c].step(inp, fb, d1, d2);
      for (let a = 0; a < aps.length; a++) s = aps[a].step(s);
      const m = this.mix.next();
      y[i] = m === 0 ? v : v + m * (s * SCALE_WET - v);
    }
  }
  latency() { return 0; }
  reset() {
    this.combs.forEach((c) => { c.buf.fill(0); c.i = 0; c.store = 0; });
    this.aps.forEach((a) => { a.buf.fill(0); a.i = 0; });
    this.mix.snap();
  }
}

export const reverb: ModuleDef<RevP> = {
  id: 'reverb', he: 'הדהוד', en: 'Reverb',
  blurb: 'תחושה של חדר או אולם סביב הקול',
  params: [
    { key: 'size', he: 'גודל', en: 'Size', min: 0, max: 100, def: 30, step: 1, unit: '%', scale: 'lin' },
    { key: 'damp', he: 'ריכוך', en: 'Damp', min: 0, max: 100, def: 50, step: 1, unit: '%', scale: 'lin' },
    { key: 'mix', he: 'מינון', en: 'Mix', min: 0, max: 100, def: 15, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new RevProc(sr),
  experimental: true,
};

import { bandpass, peaking, type Coefs } from '../biquad';
import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface DynEqP { freq: number; q: number; thresh: number; ratio: number; range: number }
const DEF: DynEqP = { freq: 3000, q: 2, thresh: -30, ratio: 3, range: 9 };
const UPDATE = 16;   // samples between coefficient updates

/**
 * One dynamic band: a band-pass detector at freq/q drives a peaking cut at the same freq/q.
 * The cut is (level − thresh)·(1 − 1/ratio), capped at range, so the band only moves when it is loud.
 */
class DynEqProc implements Processor<DynEqP> {
  gr = 0;
  private sr: number; private p: DynEqP = { ...DEF };
  private det: Coefs; private dz1 = 0; private dz2 = 0;
  private c: Coefs; private z1 = 0; private z2 = 0; private n = 0;
  private y1 = 0; private aA: number; private aR: number;
  constructor(sr: number) {
    this.sr = sr; this.det = bandpass(sr, DEF.freq, DEF.q); this.c = peaking(sr, DEF.freq, DEF.q, 0);
    this.aA = Math.exp(-1 / (0.005 * sr)); this.aR = Math.exp(-1 / (0.08 * sr));
  }
  setParams(p: Partial<DynEqP>) {
    this.p = { freq: num(p.freq, DEF.freq), q: num(p.q, DEF.q), thresh: num(p.thresh, DEF.thresh), ratio: Math.max(1, num(p.ratio, DEF.ratio)), range: num(p.range, DEF.range) };
    this.det = bandpass(this.sr, this.p.freq, this.p.q);
    this.c = peaking(this.sr, this.p.freq, this.p.q, -this.gr);
  }
  process(x: Float32Array, y: Float32Array) {
    const { thresh, ratio, range, freq, q } = this.p;
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      const d = this.det, b = d.b0 * v + this.dz1;
      this.dz1 = d.b1 * v - d.a1 * b + this.dz2; this.dz2 = d.b2 * v - d.a2 * b;
      const a = Math.abs(b), lvl = a > 1e-10 ? 20 * Math.log10(a) : -200;
      const xl = Math.min(range, Math.max(0, (lvl - thresh) * (1 - 1 / ratio)));
      const r = this.aR * this.y1 + (1 - this.aR) * xl;
      this.y1 = xl > r ? xl : r;
      this.gr = this.aA * this.gr + (1 - this.aA) * this.y1;
      if (++this.n === UPDATE) { this.n = 0; this.c = peaking(this.sr, freq, q, -this.gr); }
      const c = this.c, o = c.b0 * v + this.z1;
      this.z1 = c.b1 * v - c.a1 * o + this.z2; this.z2 = c.b2 * v - c.a2 * o;
      y[i] = o;
    }
  }
  latency() { return 0; }
  reset() { this.dz1 = this.dz2 = this.z1 = this.z2 = 0; this.y1 = 0; this.gr = 0; this.n = 0; }
}

export const dyneq: ModuleDef<DynEqP> = {
  id: 'dyneq', he: 'אקולייזר דינמי', en: 'Dynamic EQ',
  blurb: 'פועל רק כשתדר מסוים צורם, ושקט בשאר הזמן',
  params: [
    { key: 'freq', he: 'תדר', en: 'Freq', min: 100, max: 12000, def: 3000, step: 1, unit: 'Hz', scale: 'log' },
    { key: 'q', he: 'רוחב', en: 'Q', min: 0.5, max: 8, def: 2, step: 0.01, unit: '', scale: 'log' },
    { key: 'thresh', he: 'סף', en: 'Threshold', min: -60, max: 0, def: -30, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'ratio', he: 'יחס', en: 'Ratio', min: 1, max: 10, def: 3, step: 0.1, unit: 'x', scale: 'log' },
    { key: 'range', he: 'מקסימום הורדה', en: 'Range', min: 0, max: 24, def: 9, step: 0.5, unit: 'dB', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new DynEqProc(sr),
};

import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface DeclickP { sens: number; length: number }
const DEF: DeclickP = { sens: 50, length: 2 };
const LOOK = 512;

/**
 * Click = a jump in the second difference far above its recent level. The detected samples (± 4, at most
 * `length` ms) are replaced by a cubic Hermite curve between the good samples around them. 512-sample look-ahead (compensated in renders);
 * with no clicks the output is the input, delayed.
 */
class DeclickProc implements Processor<DeclickP> {
  private ring = new Float32Array(1024); private n = 0;   // absolute sample counter
  private x1 = 0; private x2 = 0; private env = 1e-4; private aEnv: number;
  private factor = 24; private len = 96;
  private regions: [number, number][] = [];
  constructor(sr: number) { this.aEnv = 1 - Math.exp(-1 / (0.01 * sr)); this.setParams(DEF, sr); }
  setParams(p: Partial<DeclickP>, sr = 48000) {
    const s = Math.min(100, Math.max(0, num(p.sens, DEF.sens)));
    this.factor = 4 + 40 * (1 - s / 100);
    this.len = Math.max(4, Math.round((num(p.length, DEF.length) / 1000) * sr));
  }
  private at(i: number) { return this.ring[i & 1023]; }
  process(x: Float32Array, y: Float32Array) {
    for (let i = 0; i < x.length; i++) {
      const v = x[i], n = this.n;
      this.ring[n & 1023] = v;
      const e = Math.abs(v - 2 * this.x1 + this.x2);
      this.x2 = this.x1; this.x1 = v;
      if (n > 2 && e > 1e-3 && e > this.factor * this.env) {
        // region = the detected samples ± 4, merged while detections continue, capped at `length`
        const s = n - 4, t = n + 4, last = this.regions[this.regions.length - 1];
        if (last && s <= last[1] + 2) last[1] = Math.min(Math.max(last[1], t), last[0] + this.len);
        else this.regions.push([s, t]);
      } else this.env += (e - this.env) * this.aEnv;
      const m = n - LOOK;                                  // output sample index
      let out = m >= 0 ? this.at(m) : 0;
      while (this.regions.length && this.regions[0][1] + 2 < m) this.regions.shift();
      const r = this.regions[0];
      if (m >= 0 && r && m >= r[0] && m <= r[1]) {
        const a = r[0] - 1, b = r[1] + 1, T = b - a;
        const p0 = this.at(a), p1 = this.at(b);
        const m0 = (p0 - this.at(a - 1)) * T, m1 = (this.at(b + 1) - p1) * T;
        const t = (m - a) / T, t2 = t * t, t3 = t2 * t;
        out = (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
      }
      y[i] = out;
      this.n++;
    }
  }
  latency() { return LOOK; }
  reset() { this.ring.fill(0); this.n = 0; this.x1 = this.x2 = 0; this.env = 1e-4; this.regions = []; }
}

export const declick: ModuleDef<DeclickP> = {
  id: 'declick', he: 'מנקה קליקים', en: 'De-click',
  blurb: 'מוחק קליקים קטנים של הפה והשפתיים',
  params: [
    { key: 'sens', he: 'רגישות', en: 'Sensitivity', min: 0, max: 100, def: 50, step: 1, unit: '%', scale: 'lin' },
    { key: 'length', he: 'אורך קליק', en: 'Max length', min: 0.5, max: 5, def: 2, step: 0.1, unit: 'ms', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new DeclickProc(sr),
};

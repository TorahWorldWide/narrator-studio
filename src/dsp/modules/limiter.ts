import type { ModuleDef, Processor } from '../types';
import { dbToLin, linToDb, num } from '../util';

interface LimP { ceiling: number; release: number }
const DEF: LimP = { ceiling: -1, release: 80 };

/**
 * Lookahead peak limiter: the signal is delayed by L = 5 ms while the gain is computed from the
 * maximum |x| of the window [n−L, n] (monotonic deque), instant attack, exponential release.
 * The output sample x[n−L]·g[n] never exceeds the ceiling because g[n] ≤ ceiling / max(window).
 */
class LimiterProc implements Processor<LimP> {
  gr = 0;
  private L: number; private N: number;
  private ring: Float32Array; private w = 0; private n = 0;
  private dqI: Float64Array; private dqV: Float64Array; private head = 0; private tail = 0; private cap: number;
  private g = 1; private ceil = dbToLin(DEF.ceiling); private aR = 0; private sr: number;
  constructor(sr: number) {
    this.sr = sr;
    this.L = Math.round(0.005 * sr); this.N = this.L + 1;
    this.ring = new Float32Array(this.N);
    this.cap = this.N + 1; this.dqI = new Float64Array(this.cap); this.dqV = new Float64Array(this.cap);
    this.setParams(DEF);
  }
  setParams(p: Partial<LimP>) {
    this.ceil = dbToLin(num(p.ceiling, DEF.ceiling));
    this.aR = Math.exp(-1 / ((num(p.release, DEF.release) / 1000) * this.sr));
  }
  process(x: Float32Array, y: Float32Array) {
    const { ring, N, L, dqI, dqV, cap } = this;
    let { w, n, head, tail, g } = this;
    const ceil = this.ceil, aR = this.aR;
    for (let i = 0; i < x.length; i++, n++) {
      const v = x[i], a = Math.abs(v);
      ring[w] = v;
      while (head !== tail && dqV[(tail - 1 + cap) % cap] <= a) tail = (tail - 1 + cap) % cap;
      dqI[tail] = n; dqV[tail] = a; tail = (tail + 1) % cap;
      while (dqI[head] < n - L) head = (head + 1) % cap;
      const m = dqV[head];
      const target = m > ceil ? ceil / m : 1;
      g = target < g ? target : target + (g - target) * aR;
      w = w + 1 === N ? 0 : w + 1;
      y[i] = ring[w] * g;           // ring[w] now holds x[n−L]
    }
    this.w = w; this.n = n; this.head = head; this.tail = tail; this.g = g;
    this.gr = -linToDb(g);
  }
  latency() { return this.L; }
  reset() { this.ring.fill(0); this.w = 0; this.n = 0; this.head = 0; this.tail = 0; this.g = 1; this.gr = 0; }
}

export const limiter: ModuleDef<LimP> = {
  id: 'limiter', he: 'לימיטר', en: 'Limiter',
  blurb: 'תקרה קשיחה — שום רגע לא יעבור את העוצמה שבוחרים',
  params: [
    { key: 'ceiling', he: 'תקרה', en: 'Ceiling', min: -12, max: 0, def: -1, step: 0.1, unit: 'dB', scale: 'lin' },
    { key: 'release', he: 'שחרור', en: 'Release', min: 10, max: 500, def: 80, step: 1, unit: 'ms', scale: 'log' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new LimiterProc(sr),
};

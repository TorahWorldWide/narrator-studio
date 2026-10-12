import type { ModuleDef, Processor } from '../types';
import { Smoother, dbToLin, num } from '../util';

export interface CompP { thresh: number; ratio: number; attack: number; release: number; knee: number; makeup: number }
const DEF: CompP = { thresh: -18, ratio: 2, attack: 10, release: 120, knee: 6, makeup: 0 };

/**
 * Feed-forward compressor gain computer: peak detector in the dB domain, soft knee,
 * smooth decoupled attack/release one-poles on the gain reduction (a release-only peak hold,
 * then attack smoothing — Giannoulis/Massberg/Reiss 2012). Shared with the de-esser.
 */
export class CompCore {
  gr = 0;                       // current gain reduction, dB ≥ 0
  private y1 = 0;               // peak-hold stage (release only)
  private sr: number;
  private T = DEF.thresh; private R = DEF.ratio; private W = DEF.knee;
  private aA = 0; private aR = 0;
  constructor(sr: number) { this.sr = sr; this.set(DEF); }
  set(p: Partial<CompP>) {
    this.T = num(p.thresh, DEF.thresh);
    this.R = Math.max(1, num(p.ratio, DEF.ratio));
    this.W = Math.max(0, num(p.knee, DEF.knee));
    this.aA = Math.exp(-1 / ((num(p.attack, DEF.attack) / 1000) * this.sr));
    this.aR = Math.exp(-1 / ((num(p.release, DEF.release) / 1000) * this.sr));
  }
  /** Feed one detector sample; returns the linear gain to apply. */
  step(v: number): number {
    const a = Math.abs(v);
    const xg = a > 1e-10 ? 20 * Math.log10(a) : -200;
    const { T, R, W } = this;
    const d = xg - T;
    let yg: number;
    if (2 * d < -W) yg = xg;
    else if (W > 0 && 2 * Math.abs(d) <= W) yg = xg + ((1 / R - 1) * (d + W / 2) * (d + W / 2)) / (2 * W);
    else yg = T + d / R;
    const xl = xg - yg;
    const r = this.aR * this.y1 + (1 - this.aR) * xl;
    this.y1 = xl > r ? xl : r;
    this.gr = this.aA * this.gr + (1 - this.aA) * this.y1;
    return Math.pow(10, -this.gr / 20);
  }
  reset() { this.gr = 0; this.y1 = 0; }
}

class CompProc implements Processor<CompP> {
  private core: CompCore; private mk: Smoother;
  constructor(sr: number) { this.core = new CompCore(sr); this.mk = new Smoother(sr); }
  get gr() { return this.core.gr; }
  setParams(p: Partial<CompP>) { this.core.set(p); this.mk.set(dbToLin(num(p.makeup, DEF.makeup))); }
  process(x: Float32Array, y: Float32Array) {
    for (let i = 0; i < x.length; i++) { const v = x[i]; y[i] = v * this.core.step(v) * this.mk.next(); }
  }
  latency() { return 0; }
  reset() { this.core.reset(); this.mk.snap(); }
}

export const comp: ModuleDef<CompP> = {
  id: 'comp', he: 'קומפרסור', en: 'Compressor',
  blurb: 'משווה בין מילים חזקות לחלשות כדי שהקול יהיה אחיד',
  params: [
    { key: 'thresh', he: 'סף', en: 'Threshold', min: -60, max: 0, def: -18, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'ratio', he: 'יחס', en: 'Ratio', min: 1, max: 20, def: 2, step: 0.1, unit: 'x', scale: 'log' },
    { key: 'attack', he: 'תגובה', en: 'Attack', min: 0.1, max: 100, def: 10, step: 0.1, unit: 'ms', scale: 'log' },
    { key: 'release', he: 'שחרור', en: 'Release', min: 10, max: 1000, def: 120, step: 1, unit: 'ms', scale: 'log' },
    { key: 'knee', he: 'רכות', en: 'Knee', min: 0, max: 24, def: 6, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'makeup', he: 'הגברה', en: 'Makeup', min: -12, max: 24, def: 0, step: 0.1, unit: 'dB', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new CompProc(sr),
};

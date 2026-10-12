import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface ExpP { thresh: number; ratio: number; range: number; attack: number; release: number }
const DEF: ExpP = { thresh: -45, ratio: 2, range: 24, attack: 2, release: 120 };

/** Downward expander: below the threshold the level drops (thresh − level)·(ratio − 1) dB, at most `range`. */
class ExpProc implements Processor<ExpP> {
  gr = 0;
  private sr: number; private win: number; private buf: Float64Array; private idx = 0; private sum = 0;
  private p = { ...DEF }; private aA = 0; private aR = 0;
  constructor(sr: number) { this.sr = sr; this.win = Math.round(0.005 * sr); this.buf = new Float64Array(this.win); }
  setParams(p: Partial<ExpP>) {
    this.p = { thresh: num(p.thresh, DEF.thresh), ratio: Math.max(1, num(p.ratio, DEF.ratio)), range: num(p.range, DEF.range), attack: num(p.attack, DEF.attack), release: num(p.release, DEF.release) };
    this.aA = 1 - Math.exp(-1 / ((this.p.attack / 1000) * this.sr));
    this.aR = 1 - Math.exp(-1 / ((this.p.release / 1000) * this.sr));
  }
  process(x: Float32Array, y: Float32Array) {
    const { thresh, ratio, range } = this.p, buf = this.buf, win = this.win;
    for (let i = 0; i < x.length; i++) {
      const v = x[i], s = v * v;
      this.sum += s - buf[this.idx]; buf[this.idx] = s;
      if (++this.idx === win) { this.idx = 0; this.sum = 0; for (let k = 0; k < win; k++) this.sum += buf[k]; }
      const ms = this.sum / win, lvl = ms > 1e-20 ? 10 * Math.log10(ms) : -200;
      const target = Math.min(range, Math.max(0, (thresh - lvl) * (ratio - 1)));
      this.gr += (target - this.gr) * (target < this.gr ? this.aA : this.aR);
      y[i] = this.gr === 0 ? v : v * Math.pow(10, -this.gr / 20);
    }
  }
  latency() { return 0; }
  reset() { this.buf.fill(0); this.idx = 0; this.sum = 0; this.gr = 0; }
}

export const expander: ModuleDef<ExpP> = {
  id: 'expander', he: 'מרחיב', en: 'Expander',
  blurb: 'כמו שער רעש, אבל מנמיך את הקטעים השקטים בהדרגה, בלי חיתוך',
  params: [
    { key: 'thresh', he: 'סף', en: 'Threshold', min: -80, max: 0, def: -45, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'ratio', he: 'יחס', en: 'Ratio', min: 1, max: 10, def: 2, step: 0.1, unit: 'x', scale: 'log' },
    { key: 'range', he: 'מקסימום הורדה', en: 'Range', min: 0, max: 60, def: 24, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'attack', he: 'פתיחה', en: 'Attack', min: 0.5, max: 50, def: 2, step: 0.1, unit: 'ms', scale: 'log' },
    { key: 'release', he: 'שחרור', en: 'Release', min: 10, max: 1000, def: 120, step: 1, unit: 'ms', scale: 'log' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new ExpProc(sr),
};

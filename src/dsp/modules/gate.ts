import type { ModuleDef, Processor } from '../types';
import { dbToLin, linToDb, num, onePole } from '../util';

interface GateP { thresh: number; range: number; attack: number; hold: number; release: number }
const DEF: GateP = { thresh: -45, range: 12, attack: 2, hold: 80, release: 150 };

/** Direction א׳ as a knob: 5 ms RMS detector; below threshold the gain falls to −range dB. */
class GateProc implements Processor<GateP> {
  gr = 0;
  private sr: number; private win: number; private buf: Float64Array; private idx = 0; private sum = 0;
  private g = 1; private holdLeft = 0;
  private thr2 = 0; private floor = 1; private aA = 1; private aR = 1; private holdN = 0;
  constructor(sr: number) {
    this.sr = sr; this.win = Math.max(1, Math.round(0.005 * sr)); this.buf = new Float64Array(this.win);
  }
  setParams(p: Partial<GateP>) {
    this.thr2 = Math.pow(10, num(p.thresh, DEF.thresh) / 10);
    this.floor = dbToLin(-num(p.range, DEF.range));
    this.aA = onePole(num(p.attack, DEF.attack), this.sr);
    this.aR = onePole(num(p.release, DEF.release), this.sr);
    this.holdN = Math.round((num(p.hold, DEF.hold) / 1000) * this.sr);
  }
  process(x: Float32Array, y: Float32Array) {
    const buf = this.buf, win = this.win;
    let { idx, sum, g, holdLeft } = this;
    for (let i = 0; i < x.length; i++) {
      const v = x[i], s = v * v;
      sum += s - buf[idx]; buf[idx] = s;
      if (++idx === win) { // re-sum once per window so rounding never accumulates
        idx = 0; sum = 0;
        for (let k = 0; k < win; k++) sum += buf[k];
      }
      let target: number;
      if (sum / win >= this.thr2) { holdLeft = this.holdN; target = 1; }
      else if (holdLeft > 0) { holdLeft--; target = 1; }
      else target = this.floor;
      g += (target - g) * (target > g ? this.aA : this.aR);
      y[i] = v * g;
    }
    this.idx = idx; this.sum = sum; this.g = g; this.holdLeft = holdLeft;
    this.gr = -linToDb(g);
  }
  latency() { return 0; }
  reset() { this.buf.fill(0); this.idx = 0; this.sum = 0; this.g = 1; this.holdLeft = 0; this.gr = 0; }
}

export const gate: ModuleDef<GateP> = {
  id: 'gate', he: 'שער רעש', en: 'Gate',
  blurb: 'מנמיך את הרעש בהפסקות שבין המילים (כיוון א׳)',
  params: [
    { key: 'thresh', he: 'סף', en: 'Threshold', min: -80, max: 0, def: -45, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'range', he: 'כמה להנמיך', en: 'Range', min: 0, max: 60, def: 12, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'attack', he: 'פתיחה', en: 'Attack', min: 0.5, max: 50, def: 2, step: 0.1, unit: 'ms', scale: 'log' },
    { key: 'hold', he: 'החזקה', en: 'Hold', min: 0, max: 500, def: 80, step: 1, unit: 'ms', scale: 'lin' },
    { key: 'release', he: 'שחרור', en: 'Release', min: 10, max: 1000, def: 150, step: 1, unit: 'ms', scale: 'log' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new GateProc(sr),
};

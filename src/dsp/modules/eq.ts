import { Cascade, highshelf, lowshelf, peaking, type Coefs } from '../biquad';
import type { ModuleDef, ParamDef, Processor } from '../types';
import { num } from '../util';

/** Band types: 0 peak, 1 low shelf, 2 high shelf. */
type EqP = Record<string, number>;

const BANDS = [
  { type: 1, freq: 150, gain: 0, q: 0.707 },
  { type: 0, freq: 400, gain: 0, q: 1 },
  { type: 0, freq: 3000, gain: 0, q: 1 },
  { type: 2, freq: 8000, gain: 0, q: 0.707 },
];

const defaults = (): EqP => {
  const p: EqP = {};
  BANDS.forEach((b, i) => {
    const k = `b${i + 1}`;
    p[`${k}type`] = b.type; p[`${k}freq`] = b.freq; p[`${k}gain`] = b.gain; p[`${k}q`] = b.q;
  });
  return p;
};

const params: ParamDef[] = BANDS.flatMap((b, i) => {
  const n = i + 1, k = `b${n}`;
  return [
    { key: `${k}type`, he: `סוג ${n}`, en: `Type ${n}`, min: 0, max: 2, def: b.type, step: 1, unit: '', scale: 'lin' },
    { key: `${k}freq`, he: `תדר ${n}`, en: `Freq ${n}`, min: 20, max: 20000, def: b.freq, step: 1, unit: 'Hz', scale: 'log' },
    { key: `${k}gain`, he: `עוצמה ${n}`, en: `Gain ${n}`, min: -18, max: 18, def: b.gain, step: 0.1, unit: 'dB', scale: 'lin' },
    { key: `${k}q`, he: `רוחב ${n}`, en: `Q ${n}`, min: 0.3, max: 8, def: b.q, step: 0.01, unit: '', scale: 'log' },
  ] as ParamDef[];
});

class EqProc implements Processor<EqP> {
  private cas = new Cascade();
  private sr: number; private key = '';
  constructor(sr: number) { this.sr = sr; }
  setParams(p: EqP) {
    const d = defaults();
    const v = (k: string) => num(p[k], d[k]);
    const cs: Coefs[] = [];
    for (let i = 1; i <= 4; i++) {
      const t = Math.round(v(`b${i}type`)), f = v(`b${i}freq`), g = v(`b${i}gain`), q = v(`b${i}q`);
      cs.push(t === 1 ? lowshelf(this.sr, f, q, g) : t === 2 ? highshelf(this.sr, f, q, g) : peaking(this.sr, f, q, g));
    }
    const key = JSON.stringify(cs);
    if (key === this.key) return;
    this.key = key;
    this.cas.setAll(cs);
  }
  process(x: Float32Array, y: Float32Array) { this.cas.process(x, y); }
  latency() { return 0; }
  reset() { this.cas.reset(); }
}

export const eq: ModuleDef<EqP> = {
  id: 'eq', he: 'אקולייזר', en: 'EQ 4 bands',
  blurb: 'ארבעה פסים לעיצוב הצליל: בס, אמצע, נוכחות, אוויר',
  params,
  defaults,
  create: (sr) => new EqProc(sr),
};

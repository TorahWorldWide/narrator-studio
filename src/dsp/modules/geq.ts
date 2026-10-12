import { Cascade, peaking } from '../biquad';
import type { ModuleDef, ParamDef, Processor } from '../types';
import { num } from '../util';

/** 10-band graphic EQ: fixed octave peaking bands (Q 1.41), ±12 dB each. */
export const GEQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const geqKey = (f: number) => `g${f}`;
const label = (f: number) => (f >= 1000 ? `${f / 1000}k` : String(f));
type GeqP = Record<string, number>;
const defaults = (): GeqP => Object.fromEntries(GEQ_BANDS.map((f) => [geqKey(f), 0]));

class GeqProc implements Processor<GeqP> {
  private cas = new Cascade(); private sr: number; private key = '';
  constructor(sr: number) { this.sr = sr; }
  setParams(p: GeqP) {
    const gains = GEQ_BANDS.map((f) => num(p[geqKey(f)], 0));
    const key = gains.join('|');
    if (key === this.key) return;
    this.key = key;
    this.cas.setAll(GEQ_BANDS.map((f, i) => peaking(this.sr, Math.min(f, this.sr * 0.45), 1.41, gains[i])));
  }
  process(x: Float32Array, y: Float32Array) { this.cas.process(x, y); }
  latency() { return 0; }
  reset() { this.cas.reset(); }
}

export const geq: ModuleDef<GeqP> = {
  id: 'geq', he: 'אקולייזר גרפי', en: 'Graphic EQ 10',
  blurb: '10 סליידרים קבועים מהבס ועד הגבוהים, פשוט ומהיר',
  params: GEQ_BANDS.map((f): ParamDef => ({ key: geqKey(f), he: label(f), en: `${label(f)} Hz`, min: -12, max: 12, def: 0, step: 0.5, unit: 'dB', scale: 'lin' })),
  defaults,
  create: (sr) => new GeqProc(sr),
};

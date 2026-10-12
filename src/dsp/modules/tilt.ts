import { Cascade, highshelf, lowshelf } from '../biquad';
import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface TiltP { tilt: number; pivot: number }
const DEF: TiltP = { tilt: 0, pivot: 1000 };

/** Low shelf −tilt/2 and high shelf +tilt/2 at the pivot: negative = warmer, positive = brighter. */
class TiltProc implements Processor<TiltP> {
  private cas = new Cascade(); private sr: number; private key = '';
  constructor(sr: number) { this.sr = sr; }
  setParams(p: Partial<TiltP>) {
    const t = num(p.tilt, DEF.tilt), f = num(p.pivot, DEF.pivot), key = `${t}|${f}`;
    if (key === this.key) return;
    this.key = key;
    this.cas.setAll([lowshelf(this.sr, f, 0.5, -t / 2), highshelf(this.sr, f, 0.5, t / 2)]);
  }
  process(x: Float32Array, y: Float32Array) { this.cas.process(x, y); }
  latency() { return 0; }
  reset() { this.cas.reset(); }
}

export const tilt: ModuleDef<TiltP> = {
  id: 'tilt', he: 'חם ↔ בהיר', en: 'Tilt EQ',
  blurb: 'כפתור אחד שמטה את כל הצליל לחם יותר או לבהיר יותר',
  params: [
    { key: 'tilt', he: 'חם ← → בהיר', en: 'Tilt', min: -6, max: 6, def: 0, step: 0.1, unit: 'dB', scale: 'lin' },
    { key: 'pivot', he: 'ציר', en: 'Pivot', min: 300, max: 3000, def: 1000, step: 1, unit: 'Hz', scale: 'log' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new TiltProc(sr),
};

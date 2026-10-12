import { Cascade, notch } from '../biquad';
import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface HumP { freq: number; harmonics: number; q: number; depth: number }
const DEF: HumP = { freq: 61, harmonics: 3, q: 10, depth: 30 };

/** Cascaded RBJ notches (finite depth) at k·freq, k = 1..harmonics. */
class HumProc implements Processor<HumP> {
  private cas = new Cascade(); private sr: number; private key = '';
  constructor(sr: number) { this.sr = sr; }
  setParams(p: Partial<HumP>) {
    const f = num(p.freq, DEF.freq), h = Math.max(1, Math.min(6, Math.round(num(p.harmonics, DEF.harmonics))));
    const q = num(p.q, DEF.q), d = num(p.depth, DEF.depth);
    const key = `${f}|${h}|${q}|${d}`;
    if (key === this.key) return;
    this.key = key;
    const cs = [];
    for (let k = 1; k <= h; k++) if (k * f < this.sr * 0.45) cs.push(notch(this.sr, k * f, q, d));
    this.cas.setAll(cs);
  }
  process(x: Float32Array, y: Float32Array) { this.cas.process(x, y); }
  latency() { return 0; }
  reset() { this.cas.reset(); }
}

export const HUM_WARNING = 'חריצים צרים עלולים לצלצל בהפסקות — תקשיב';

export const hum: ModuleDef<HumP> = {
  id: 'hum', he: 'חריץ זמזום', en: 'Hum notch',
  blurb: 'מוחק זמזום חשמל בתדר אחד והרמוניות שלו',
  params: [
    { key: 'freq', he: 'תדר', en: 'Freq', min: 40, max: 400, def: 61, step: 0.1, unit: 'Hz', scale: 'log' },
    { key: 'harmonics', he: 'הרמוניות', en: 'Harmonics', min: 1, max: 6, def: 3, step: 1, unit: '', scale: 'lin' },
    { key: 'q', he: 'צרות', en: 'Q', min: 2, max: 60, def: 10, step: 0.1, unit: '', scale: 'log' },
    { key: 'depth', he: 'עומק', en: 'Depth', min: 6, max: 60, def: 30, step: 0.5, unit: 'dB', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new HumProc(sr),
};

import { BUTTER_Q, Cascade, butterOrder, highpass, lowpass } from '../biquad';
import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface FilterP { freq: number; order: number }

export class ButterProc implements Processor<FilterP> {
  private cas = new Cascade();
  private sr: number; private kind: 'hp' | 'lp'; private def: FilterP;
  private freq = NaN; private order = NaN;
  constructor(sr: number, kind: 'hp' | 'lp', def: FilterP) { this.sr = sr; this.kind = kind; this.def = def; }
  setParams(p: Partial<FilterP>) {
    const freq = num(p.freq, this.def.freq), order = butterOrder(num(p.order, this.def.order));
    if (freq === this.freq && order === this.order) return;
    this.freq = freq; this.order = order;
    const mk = this.kind === 'hp' ? highpass : lowpass;
    this.cas.setAll(BUTTER_Q[order].map((q) => mk(this.sr, freq, q)));
  }
  process(x: Float32Array, y: Float32Array) { this.cas.process(x, y); }
  latency() { return 0; }
  reset() { this.cas.reset(); }
}

export const hp: ModuleDef<FilterP> = {
  id: 'hp', he: 'מסנן נמוכים', en: 'High-pass',
  blurb: 'חותך רעמים וזמזום נמוך מתחת לתדר שבוחרים',
  params: [
    { key: 'freq', he: 'תדר', en: 'Freq', min: 20, max: 400, def: 95, step: 1, unit: 'Hz', scale: 'log' },
    { key: 'order', he: 'חדות', en: 'Order', min: 2, max: 8, def: 4, step: 2, unit: '', scale: 'lin' },
  ],
  defaults: () => ({ freq: 95, order: 4 }),
  create: (sr) => new ButterProc(sr, 'hp', { freq: 95, order: 4 }),
};

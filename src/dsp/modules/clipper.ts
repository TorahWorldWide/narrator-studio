import type { ModuleDef, Processor } from '../types';
import { dbToLin, num } from '../util';

interface ClipP { ceiling: number; knee: number }
const DEF: ClipP = { ceiling: -1, knee: 3 };

/** Linear below the knee, tanh curve above it, never above the ceiling (slope stays continuous). */
class ClipProc implements Processor<ClipP> {
  private C = dbToLin(-1); private T = dbToLin(-4);
  setParams(p: Partial<ClipP>) {
    this.C = dbToLin(num(p.ceiling, DEF.ceiling));
    this.T = this.C * dbToLin(-Math.max(0.01, num(p.knee, DEF.knee)));
  }
  process(x: Float32Array, y: Float32Array) {
    const { C, T } = this, span = C - T;
    for (let i = 0; i < x.length; i++) {
      const v = x[i], a = Math.abs(v);
      y[i] = a <= T ? v : Math.sign(v) * (T + span * Math.tanh((a - T) / span));
    }
  }
  latency() { return 0; }
  reset() { /* stateless */ }
}

export const clipper: ModuleDef<ClipP> = {
  id: 'clipper', he: 'קליפר רך', en: 'Soft clipper',
  blurb: 'מעגל שיאים חדים בלי שישמעו את העבודה',
  params: [
    { key: 'ceiling', he: 'תקרה', en: 'Ceiling', min: -12, max: 0, def: -1, step: 0.1, unit: 'dB', scale: 'lin' },
    { key: 'knee', he: 'רכות', en: 'Knee', min: 0, max: 12, def: 3, step: 0.1, unit: 'dB', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: () => new ClipProc(),
};

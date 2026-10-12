import type { ModuleDef, Processor } from '../types';
import { Smoother, dbToLin, num } from '../util';

interface LoudP { target: number }
const DEF: LoudP = { target: -19 };
const MAX_GAIN = 24;

/**
 * One fixed gain = target − (integrated LUFS of this module's input over the whole chapter).
 * The host measures by rendering the chain before this module (renderOffline does it itself; for
 * listening the main thread asks a worker) and calls setMeasured(lufs). Until then: unity gain.
 */
export class LoudProc implements Processor<LoudP> {
  measured: number | null = null;
  private target = DEF.target; private g: Smoother;
  constructor(sr: number) { this.g = new Smoother(sr, 50); this.g.set(1); }
  get gainDb() { return this.measured === null || !Number.isFinite(this.measured) ? 0 : Math.max(-MAX_GAIN, Math.min(MAX_GAIN, this.target - this.measured)); }
  setParams(p: Partial<LoudP>) { this.target = num(p.target, DEF.target); this.g.set(dbToLin(this.gainDb)); }
  setMeasured(lufs: number) { this.measured = lufs; this.g.set(dbToLin(this.gainDb)); }
  process(x: Float32Array, y: Float32Array) { for (let i = 0; i < x.length; i++) y[i] = x[i] * this.g.next(); }
  latency() { return 0; }
  reset() { this.g.snap(); }
}

export const canMeasure = (p: unknown): p is { setMeasured(l: number): void } =>
  typeof (p as { setMeasured?: unknown } | null)?.setMeasured === 'function';

export const loudness: ModuleDef<LoudP> = {
  id: 'loudness', he: 'מנרמל עוצמה', en: 'Loudness',
  blurb: 'מביא כל פרק לאותה עוצמה (LUFS), כדי שלא יהיו פרקים חזקים וחלשים',
  params: [
    { key: 'target', he: 'יעד', en: 'Target', min: -30, max: -10, def: -19, step: 0.1, unit: 'dB', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new LoudProc(sr),
};

export const dbToLin = (db: number) => Math.pow(10, db / 20);
export const linToDb = (v: number) => (v > 1e-10 ? 20 * Math.log10(v) : -200);
/** One-pole coefficient for time constant `ms` at `sr` (fraction of the distance moved per sample). */
export const onePole = (ms: number, sr: number) => (ms <= 0 ? 1 : 1 - Math.exp(-1 / ((ms / 1000) * sr)));
export const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Gain-like parameter smoothing: one-pole, τ = 10 ms; the first set() snaps. */
export class Smoother {
  v = 0; t = 0; private a: number; private fresh = true;
  constructor(sr: number, ms = 10) { this.a = onePole(ms, sr); }
  set(target: number) { this.t = target; if (this.fresh) { this.v = target; this.fresh = false; } }
  next() { this.v += (this.t - this.v) * this.a; return this.v; }
  snap() { this.v = this.t; }
}

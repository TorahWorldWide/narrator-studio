import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface RiderP { target: number; range: number; speed: number; gate: number }
const DEF: RiderP = { target: -20, range: 6, speed: 400, gate: -45 };

/**
 * Vocal rider: 100 ms look-ahead RMS of the coming audio; while it is speech (above `gate`) the gain
 * moves toward target − level (± range) with time constant `speed`; in pauses the gain holds.
 */
class RiderProc implements Processor<RiderP> {
  private sr: number; private L: number; private ring: Float32Array; private w = 0;
  private sq: Float64Array; private sum = 0; private p = { ...DEF }; private a = 0;
  private g = 0; private goal = 0;
  constructor(sr: number) {
    this.sr = sr; this.L = Math.round(0.1 * sr);
    this.ring = new Float32Array(this.L); this.sq = new Float64Array(this.L);
  }
  setParams(p: Partial<RiderP>) {
    this.p = { target: num(p.target, DEF.target), range: num(p.range, DEF.range), speed: num(p.speed, DEF.speed), gate: num(p.gate, DEF.gate) };
    this.a = 1 - Math.exp(-1 / ((this.p.speed / 1000) * this.sr));
  }
  process(x: Float32Array, y: Float32Array) {
    const { L, ring, sq } = this, { target, range, gate } = this.p;
    for (let i = 0; i < x.length; i++) {
      const v = x[i], out = ring[this.w];          // x[n − L]
      ring[this.w] = v;
      this.sum += v * v - sq[this.w]; sq[this.w] = v * v;
      if (++this.w === L) { this.w = 0; this.sum = 0; for (let k = 0; k < L; k++) this.sum += sq[k]; }
      const ms = this.sum / L, lvl = ms > 1e-20 ? 10 * Math.log10(ms) : -200;
      if (lvl > gate) this.goal = Math.max(-range, Math.min(range, target - lvl));
      this.g += (this.goal - this.g) * this.a;
      y[i] = this.g === 0 ? out : out * Math.pow(10, this.g / 20);
    }
  }
  latency() { return this.L; }
  reset() { this.ring.fill(0); this.sq.fill(0); this.sum = 0; this.w = 0; this.g = 0; this.goal = 0; }
}

export const rider: ModuleDef<RiderP> = {
  id: 'rider', he: 'רוכב עוצמה', en: 'Vocal rider',
  blurb: 'מגביר בעדינות מילים שנאמרו חלש ומנמיך חזקות, כמו טכנאי שמזיז פיידר',
  params: [
    { key: 'target', he: 'יעד', en: 'Target', min: -40, max: -6, def: -20, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'range', he: 'טווח', en: 'Range', min: 0, max: 12, def: 6, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'speed', he: 'מהירות', en: 'Speed', min: 50, max: 2000, def: 400, step: 1, unit: 'ms', scale: 'log' },
    { key: 'gate', he: 'סף דיבור', en: 'Gate', min: -70, max: -20, def: -45, step: 0.5, unit: 'dB', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new RiderProc(sr),
};

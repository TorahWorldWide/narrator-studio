import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface TransP { attack: number; sustain: number }
const DEF: TransP = { attack: 0, sustain: 0 };

/**
 * Two peak followers on |x| (fast 1/20 ms, slow 30/200 ms). Where fast > slow the sound is starting
 * (attack), where slow > fast it is ringing out (sustain); each part gets its own boost/cut in dB.
 */
class TransProc implements Processor<TransP> {
  private fast = 0; private slow = 0; private g = 0;
  private fa: number; private fr: number; private sa: number; private sr2: number; private gs: number;
  private att = 0; private sus = 0;
  constructor(sr: number) {
    const c = (ms: number) => Math.exp(-1 / ((ms / 1000) * sr));
    this.fa = c(1); this.fr = c(20); this.sa = c(30); this.sr2 = c(200); this.gs = c(1);
  }
  setParams(p: Partial<TransP>) { this.att = num(p.attack, DEF.attack) / 100; this.sus = num(p.sustain, DEF.sustain) / 100; }
  process(x: Float32Array, y: Float32Array) {
    for (let i = 0; i < x.length; i++) {
      const v = x[i], a = Math.abs(v);
      this.fast = a > this.fast ? this.fa * this.fast + (1 - this.fa) * a : this.fr * this.fast + (1 - this.fr) * a;
      this.slow = a > this.slow ? this.sa * this.slow + (1 - this.sa) * a : this.sr2 * this.slow + (1 - this.sr2) * a;
      let target = 0;
      if (this.att !== 0 || this.sus !== 0) {
        const d = this.fast > 1e-9 && this.slow > 1e-9 ? 20 * Math.log10(this.fast / this.slow) : 0;
        target = d > 0 ? this.att * d : this.sus * -d;
        target = Math.max(-18, Math.min(18, target));
      }
      this.g = this.gs * this.g + (1 - this.gs) * target;
      y[i] = this.g === 0 ? v : v * Math.pow(10, this.g / 20);
    }
  }
  latency() { return 0; }
  reset() { this.fast = this.slow = this.g = 0; }
}

export const transient: ModuleDef<TransP> = {
  id: 'transient', he: 'מעצב התקפות', en: 'Transient shaper',
  blurb: 'מחדד או מרכך את תחילת ההברות, ואת הזנב שאחריהן',
  params: [
    { key: 'attack', he: 'התקפה', en: 'Attack', min: -100, max: 100, def: 0, step: 1, unit: '%', scale: 'lin' },
    { key: 'sustain', he: 'זנב', en: 'Sustain', min: -100, max: 100, def: 0, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new TransProc(sr),
};

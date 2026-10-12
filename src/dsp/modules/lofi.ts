import { BUTTER_Q, Cascade, highpass, lowpass, peaking, type Coefs } from '../biquad';
import type { ModuleDef, Processor } from '../types';
import { Smoother, dbToLin, num } from '../util';

/** type 0 phone (300–3400 Hz), 1 old radio (200–4500 Hz + 1.5 kHz honk, hiss and crackle). */
interface LofiP { type: number; drive: number; bits: number; noise: number; mix: number }
const DEF: LofiP = { type: 0, drive: 6, bits: 12, noise: 20, mix: 100 };

class LofiProc implements Processor<LofiP> {
  private sr: number; private cas = new Cascade(); private type = -1;
  private g = 1; private nrm = 1; private q = 2048; private noise = 0; private mix: Smoother;
  private seed = 22222; private tmp = new Float32Array(128);
  constructor(sr: number) { this.sr = sr; this.mix = new Smoother(sr); }
  setParams(p: Partial<LofiP>) {
    const type = Math.round(num(p.type, DEF.type)) === 1 ? 1 : 0;
    if (type !== this.type) {
      this.type = type;
      const [lo, hi] = type === 0 ? [300, 3400] : [200, 4500];
      const cs: Coefs[] = [...BUTTER_Q[4].map((q) => highpass(this.sr, lo, q)), ...BUTTER_Q[4].map((q) => lowpass(this.sr, hi, q))];
      if (type === 1) cs.push(peaking(this.sr, 1500, 1.2, 4));
      this.cas.setAll(cs);
    }
    this.g = dbToLin(num(p.drive, DEF.drive)); this.nrm = 1 / Math.tanh(this.g);
    this.q = Math.pow(2, Math.max(2, Math.min(16, Math.round(num(p.bits, DEF.bits)))) - 1);
    this.noise = Math.min(1, Math.max(0, num(p.noise, DEF.noise) / 100));
    this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100)));
  }
  process(x: Float32Array, y: Float32Array) {
    if (this.tmp.length !== x.length) this.tmp = new Float32Array(x.length);
    const t = this.tmp;
    for (let i = 0; i < x.length; i++) {           // deterministic hiss (+ crackle for the radio) before the band
      this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
      const r = this.seed / 2 ** 32;
      let n = (r * 2 - 1) * 0.02 * this.noise;
      if (this.type === 1 && r < 0.0004 * this.noise) n += (r < 0.0002 * this.noise ? 1 : -1) * 0.3 * this.noise;
      t[i] = x[i] + n;
    }
    this.cas.process(t, t);
    for (let i = 0; i < x.length; i++) {
      const v = x[i], m = this.mix.next();
      let s = Math.tanh(t[i] * this.g) * this.nrm;
      s = Math.round(s * this.q) / this.q;
      y[i] = m === 0 ? v : v + m * (s - v);
    }
  }
  latency() { return 0; }
  reset() { this.cas.reset(); this.seed = 22222; this.mix.snap(); }
}

export const LOFI_TYPES = ['טלפון', 'רדיו ישן'];

export const lofi: ModuleDef<LofiP> = {
  id: 'lofi', he: 'רדיו ישן/טלפון', en: 'Lo-fi',
  blurb: 'הקול נשמע כאילו הוא יוצא מטלפון או מרדיו ישן',
  params: [
    { key: 'type', he: 'סוג', en: 'Type', min: 0, max: 1, def: 0, step: 1, unit: '', scale: 'lin' },
    { key: 'drive', he: 'עיוות', en: 'Drive', min: 0, max: 24, def: 6, step: 0.1, unit: 'dB', scale: 'lin' },
    { key: 'bits', he: 'ביטים', en: 'Bits', min: 2, max: 16, def: 12, step: 1, unit: '', scale: 'lin' },
    { key: 'noise', he: 'רחש', en: 'Noise', min: 0, max: 100, def: 20, step: 1, unit: '%', scale: 'lin' },
    { key: 'mix', he: 'מינון', en: 'Mix', min: 0, max: 100, def: 100, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new LofiProc(sr),
};

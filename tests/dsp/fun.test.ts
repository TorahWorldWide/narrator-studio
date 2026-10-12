import { describe, it, expect } from 'vitest';
import { RealFFT } from '../../src/dsp/fft';
import { chorus } from '../../src/dsp/modules/chorus';
import { lofi } from '../../src/dsp/modules/lofi';
import { phaser } from '../../src/dsp/modules/phaser';
import { robot } from '../../src/dsp/modules/robot';
import { tremolo } from '../../src/dsp/modules/tremolo';
import type { ModuleDef } from '../../src/dsp/types';
import { SR, gainDb, rmsDb, run, sine } from './util';

const mk = (def: ModuleDef, p: Record<string, number>) => () => { const q = def.create(SR, {}); q.setParams({ ...def.defaults(), ...p }); return q; };
function bandPow(x: Float32Array, f0: number, f1: number) {
  const n = 1 << 15, f = new RealFFT(n), w = new Float64Array(n), re = new Float64Array(n / 2 + 1), im = new Float64Array(n / 2 + 1);
  for (let i = 0; i < n; i++) w[i] = x[8000 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  f.forward(w, re, im); let s = 0;
  for (let k = Math.round((f0 * n) / SR); k <= Math.round((f1 * n) / SR); k++) s += re[k] ** 2 + im[k] ** 2;
  return 10 * Math.log10(s + 1e-30);
}

describe('creative group', () => {
  const x = sine(440, -12);
  it('mix 0 / depth 0 are bit-identical pass-throughs; length kept', () => {
    for (const [def, p] of [[chorus, { mix: 0 }], [phaser, { mix: 0 }], [phaser, { type: 1, mix: 0 }], [lofi, { mix: 0 }], [robot, { mix: 0 }], [tremolo, { depth: 0 }]] as const) {
      const y = run(mk(def as ModuleDef, p)(), x);
      expect(y.length).toBe(x.length);
      expect(y).toEqual(x);
    }
  });
  it('chorus and phaser/flanger change the signal but keep its level roughly', () => {
    for (const [def, p] of [[chorus, { mix: 100 }], [phaser, { mix: 50 }], [phaser, { type: 1, mix: 50 }]] as const) {
      const y = run(mk(def as ModuleDef, p)(), x);
      expect(y).not.toEqual(x);
      expect(Math.abs(rmsDb(y, 24000) - rmsDb(x, 24000))).toBeLessThan(9);
    }
  });
  it('phone band: 100 Hz down ≥ 15 dB, 1 kHz within 3 dB (no drive/noise)', () => {
    const p = { drive: 0, bits: 16, noise: 0, mix: 100 };
    expect(gainDb(mk(lofi, p), 100, -20)).toBeLessThanOrEqual(-15);
    expect(Math.abs(gainDb(mk(lofi, p), 1000, -20) - 20 * Math.log10(1 / Math.tanh(1)) * 0)).toBeLessThan(3);
  });
  it('tremolo at full depth pulses down to near silence', () => {
    const y = run(mk(tremolo, { rate: 5, depth: 100 })(), sine(1000, -6));
    let mn = Infinity, mx = -Infinity;
    for (let s = 0; s + 480 <= y.length; s += 480) { const r = rmsDb(y, s, s + 480); mn = Math.min(mn, r); mx = Math.max(mx, r); }
    expect(mx - mn).toBeGreaterThan(25);
  });
  it('robot moves a 1 kHz tone to 1 kHz ± 60 Hz sidebands', () => {
    const y = run(mk(robot, { freq: 60, metal: 0, mix: 100 })(), sine(1000, -6));
    expect(bandPow(y, 1055, 1065)).toBeGreaterThan(bandPow(y, 995, 1005) + 20);
  });
});

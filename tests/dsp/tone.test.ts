import { describe, it, expect } from 'vitest';
import { RealFFT } from '../../src/dsp/fft';
import { dyneq } from '../../src/dsp/modules/dyneq';
import { exciter } from '../../src/dsp/modules/exciter';
import { geq } from '../../src/dsp/modules/geq';
import { tilt } from '../../src/dsp/modules/tilt';
import type { ModuleDef } from '../../src/dsp/types';
import { SR, gainDb, run, sine } from './util';

const mk = (def: ModuleDef, p: Record<string, number>) => () => { const q = def.create(SR, {}); q.setParams({ ...def.defaults(), ...p }); return q; };

describe('tone group', () => {
  it('graphic EQ: flat is transparent, +6 at 1k boosts 1 kHz by ≈ 6 dB and leaves 62 Hz', () => {
    expect(Math.abs(gainDb(mk(geq, {}), 1000))).toBeLessThan(0.01);
    expect(Math.abs(gainDb(mk(geq, { g1000: 6 }), 1000) - 6)).toBeLessThan(0.3);
    expect(Math.abs(gainDb(mk(geq, { g1000: 6 }), 62))).toBeLessThan(0.3);
  });
  it('dynamic EQ: a loud 3 kHz tone is cut by the range, a quiet one and a loud 300 Hz are left', () => {
    const p = { freq: 3000, q: 2, thresh: -30, ratio: 3, range: 9 };
    expect(Math.abs(gainDb(mk(dyneq, p), 3000, -6) + 9)).toBeLessThan(0.5);
    expect(Math.abs(gainDb(mk(dyneq, p), 3000, -50))).toBeLessThan(0.2);
    expect(Math.abs(gainDb(mk(dyneq, p), 300, -6))).toBeLessThan(0.5);
  });
  it('tilt +6: lows ≈ −3 dB, highs ≈ +3 dB', () => {
    expect(Math.abs(gainDb(mk(tilt, { tilt: 6 }), 50) + 3)).toBeLessThan(0.5);
    expect(Math.abs(gainDb(mk(tilt, { tilt: 6 }), 15000) - 3)).toBeLessThan(0.5);
    expect(Math.abs(gainDb(mk(tilt, { tilt: 0 }), 1000))).toBeLessThan(0.01);
  });
  it('exciter: mix 0 exact; adds a 3rd harmonic above its frequency', () => {
    const x = sine(2000, -6);
    expect(run(mk(exciter, { mix: 0 })(), x)).toEqual(x);
    const y = run(mk(exciter, { freq: 1500, drive: 18, mix: 100 })(), x);
    const n = 1 << 14, f = new RealFFT(n), w = new Float64Array(n), re = new Float64Array(n / 2 + 1), im = new Float64Array(n / 2 + 1);
    const at = (s: Float32Array, hz: number) => { for (let i = 0; i < n; i++) w[i] = s[20000 + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)); f.forward(w, re, im); const k = Math.round((hz * n) / SR); return 10 * Math.log10(re[k] ** 2 + im[k] ** 2 + 1e-30); };
    expect(at(y, 6000) - at(x, 6000)).toBeGreaterThan(30);
  });
});

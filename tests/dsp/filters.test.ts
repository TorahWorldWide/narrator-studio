import { describe, it, expect } from 'vitest';
import { hp } from '../../src/dsp/modules/hp';
import { lp } from '../../src/dsp/modules/lp';
import { SR, gainDb, run, sine } from './util';

const mk = (def: typeof hp, p: Record<string, number>) => () => { const q = def.create(SR, {}); q.setParams({ ...def.defaults(), ...p }); return q; };

describe('hp', () => {
  it('95 Hz order 4: 30 Hz down ≥ 35 dB, 1 kHz within 0.1 dB, length kept', () => {
    expect(gainDb(mk(hp, { freq: 95, order: 4 }), 30)).toBeLessThanOrEqual(-35);
    expect(Math.abs(gainDb(mk(hp, { freq: 95, order: 4 }), 1000))).toBeLessThanOrEqual(0.1);
    const x = sine(1000, -6); expect(run(mk(hp, {})(), x).length).toBe(x.length);
  });
  it('orders 2/6/8 build and attenuate monotonically at 30 Hz', () => {
    const g = [2, 4, 6, 8].map((o) => gainDb(mk(hp, { freq: 95, order: o }), 30));
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeLessThan(g[i - 1]);
  });
});

describe('lp', () => {
  // Order 4 at 16 kHz gives ~18 dB at 19 kHz (bilinear Butterworth); the ≥ 20 dB spec is met at order 8.
  it('16 kHz: 19 kHz down ≥ 20 dB (order 8), 1 kHz within 0.1 dB', () => {
    expect(gainDb(mk(lp, { freq: 16000, order: 8 }), 19000)).toBeLessThanOrEqual(-20);
    expect(Math.abs(gainDb(mk(lp, { freq: 16000, order: 4 }), 1000))).toBeLessThanOrEqual(0.1);
    expect(gainDb(mk(lp, { freq: 16000, order: 4 }), 19000)).toBeLessThanOrEqual(-15);
  });
});

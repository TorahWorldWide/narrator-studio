import { describe, it, expect } from 'vitest';
import { eq } from '../../src/dsp/modules/eq';
import { SR, gainDb } from './util';

const mk = (p: Record<string, number>) => () => { const q = eq.create(SR, {}); q.setParams({ ...eq.defaults(), ...p }); return q; };

describe('eq', () => {
  it('peak +6 dB at 1 kHz q 1', () => {
    const p = { b2freq: 1000, b2gain: 6, b2q: 1 };
    expect(Math.abs(gainDb(mk(p), 1000) - 6)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(gainDb(mk(p), 100))).toBeLessThanOrEqual(0.2);
  });
  it('defaults are flat', () => {
    expect(Math.abs(gainDb(mk({}), 1000))).toBeLessThanOrEqual(0.01);
  });
  it('shelves boost their side', () => {
    expect(gainDb(mk({ b1gain: 6 }), 50)).toBeGreaterThan(5);
    expect(gainDb(mk({ b4gain: 6 }), 15000)).toBeGreaterThan(5);
  });
});

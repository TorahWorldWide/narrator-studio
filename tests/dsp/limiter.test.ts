import { describe, it, expect } from 'vitest';
import { limiter } from '../../src/dsp/modules/limiter';
import { SR, peakDb, run, sine } from './util';

describe('limiter', () => {
  it('ceiling −1: a 0 dBFS sine never exceeds −1 dBFS after the first 5 ms; latency 240', () => {
    const l = limiter.create(SR, {});
    l.setParams({ ceiling: -1, release: 80 });
    expect(l.latency()).toBe(240);
    const y = run(l, sine(1000, 0));
    expect(peakDb(y, 240)).toBeLessThanOrEqual(-1 + 1e-5);
    expect(peakDb(y, 240)).toBeGreaterThan(-1.5);
  });
  it('delays a quiet signal by exactly the latency, unchanged', () => {
    const l = limiter.create(SR, {}); l.setParams(limiter.defaults());
    const x = new Float32Array(2000); x[100] = 0.25;
    const y = run(l, x);
    expect(y[340]).toBe(0.25);
    expect(y.reduce((a, v) => a + Math.abs(v), 0)).toBeCloseTo(0.25, 6);
  });
  it('catches a single-sample spike', () => {
    const l = limiter.create(SR, {}); l.setParams({ ceiling: -6, release: 80 });
    const x = new Float32Array(4000); x[1000] = 1;
    const y = run(l, x);
    expect(peakDb(y)).toBeLessThanOrEqual(-6 + 1e-5);
  });
});

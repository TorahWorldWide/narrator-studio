import { describe, it, expect } from 'vitest';
import { comp } from '../../src/dsp/modules/comp';
import { SR, peakDb, run, sine } from './util';

describe('comp', () => {
  it('thresh −18 ratio 2 knee 0: a −6 dBFS sine settles to ≈ −12 dBFS, gr ≈ 6 dB', () => {
    const c = comp.create(SR, {});
    c.setParams({ thresh: -18, ratio: 2, attack: 10, release: 120, knee: 0, makeup: 0 });
    const x = sine(1000, -6), y = run(c, x);
    expect(Math.abs(peakDb(y, Math.round(0.5 * SR)) + 12)).toBeLessThanOrEqual(0.5);
    expect(Math.abs((c as unknown as { gr: number }).gr - 6)).toBeLessThanOrEqual(0.5);
  });
  it('below threshold with no knee it is transparent', () => {
    const c = comp.create(SR, {});
    c.setParams({ ...comp.defaults(), knee: 0 });
    const x = sine(1000, -30), y = run(c, x);
    expect(Math.abs(peakDb(y) - peakDb(x))).toBeLessThanOrEqual(0.01);
  });
});

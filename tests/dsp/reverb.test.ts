import { describe, it, expect } from 'vitest';
import { reverb } from '../../src/dsp/modules/reverb';
import { SR, rmsDb, run, sine } from './util';

describe('reverb', () => {
  it('mix 0 is bit-identical; an impulse leaves a decaying tail; length kept', () => {
    const x = sine(300, -6);
    const a = reverb.create(SR, {}); a.setParams({ size: 50, damp: 50, mix: 0 });
    expect(run(a, x)).toEqual(x);
    const imp = new Float32Array(SR); imp[0] = 1;
    const b = reverb.create(SR, {}); b.setParams({ size: 60, damp: 40, mix: 100 });
    const y = run(b, imp);
    expect(y.length).toBe(imp.length);
    const early = rmsDb(y, 2000, 12000), late = rmsDb(y, 36000, 46000);
    expect(early).toBeGreaterThan(-60);
    expect(late).toBeLessThan(early - 6);
  });
});

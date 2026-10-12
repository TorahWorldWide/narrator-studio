import { describe, it, expect } from 'vitest';
import { sat } from '../../src/dsp/modules/sat';
import { SR, peakDb, run, sine } from './util';

describe('sat', () => {
  it('mix 0 is bit-identical; drive compresses peaks; length kept', () => {
    const x = sine(220, -1);
    const a = sat.create(SR, {}); a.setParams({ drive: 18, mix: 0 });
    expect(run(a, x)).toEqual(x);
    const b = sat.create(SR, {}); b.setParams({ drive: 18, mix: 100 });
    const y = run(b, sine(220, -20));
    expect(y.length).toBe(x.length);
    expect(peakDb(y)).toBeGreaterThan(-20 + 6);        // quiet input is pushed up by the drive/normalisation
    expect(peakDb(run(b, sine(220, 0)))).toBeLessThanOrEqual(0.0001); // full scale stays ≤ 0 dBFS
  });
});

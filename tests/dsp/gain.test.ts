import { describe, it, expect } from 'vitest';
import { gain } from '../../src/dsp/modules/gain';
import { SR, gainDb } from './util';

describe('gain', () => {
  it('applies dB gain', () => {
    const mk = (g: number) => () => { const p = gain.create(SR, {}); p.setParams({ gain: g }); return p; };
    expect(gainDb(mk(6), 1000)).toBeCloseTo(6, 2);
    expect(gainDb(mk(-12), 1000)).toBeCloseTo(-12, 2);
  });
});

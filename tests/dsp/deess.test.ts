import { describe, it, expect } from 'vitest';
import { deess } from '../../src/dsp/modules/deess';
import { SR, gainDb, run, sine } from './util';

const mk = () => { const d = deess.create(SR, {}); d.setParams(deess.defaults()); return d; };

describe('deess', () => {
  it('keeps length, leaves low/quiet material flat, compresses loud sibilance', () => {
    const x = sine(500, -6);
    expect(run(mk(), x).length).toBe(x.length);
    expect(Math.abs(gainDb(mk, 500, -6))).toBeLessThanOrEqual(0.1);     // LR4 sum is flat
    expect(Math.abs(gainDb(mk, 8000, -40))).toBeLessThanOrEqual(0.1);   // below threshold
    expect(gainDb(mk, 8000, -6)).toBeLessThanOrEqual(-6);              // −6 dBFS ess, thresh −25, 4:1
  });
});

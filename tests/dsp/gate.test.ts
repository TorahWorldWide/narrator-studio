import { describe, it, expect } from 'vitest';
import { gate } from '../../src/dsp/modules/gate';
import { SR, rmsDb, run, sine } from './util';

const mk = () => { const g = gate.create(SR, {}); g.setParams({ thresh: -45, range: 12, attack: 2, hold: 80, release: 150 }); return g; };

describe('gate', () => {
  it('a −60 dBFS sine comes out ≈ −72 dBFS (±1)', () => {
    const x = sine(1000, -60), y = run(mk(), x), from = Math.round(0.75 * SR);
    expect(Math.abs(rmsDb(y, from) - rmsDb(x, from) + 12)).toBeLessThanOrEqual(1);
  });
  it('a −20 dBFS sine is unchanged (±0.1) after 100 ms', () => {
    const x = sine(1000, -20), y = run(mk(), x), from = Math.round(0.1 * SR);
    expect(Math.abs(rmsDb(y, from) - rmsDb(x, from))).toBeLessThanOrEqual(0.1);
  });
  it('reports gain reduction', () => {
    const g = mk(); run(g, sine(1000, -60));
    expect((g as unknown as { gr: number }).gr).toBeGreaterThan(11);
  });
});

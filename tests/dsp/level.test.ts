import { describe, it, expect } from 'vitest';
import { clipper } from '../../src/dsp/modules/clipper';
import { expander } from '../../src/dsp/modules/expander';
import { mbcomp } from '../../src/dsp/modules/mbcomp';
import { rider } from '../../src/dsp/modules/rider';
import { transient } from '../../src/dsp/modules/transient';
import { renderOffline } from '../../src/dsp/rack';
import type { ModuleDef } from '../../src/dsp/types';
import { SR, gainDb, peakDb, rmsDb, run, sine } from './util';

const mk = (def: ModuleDef, p: Record<string, number>) => () => { const q = def.create(SR, {}); q.setParams({ ...def.defaults(), ...p }); return q; };

describe('level group', () => {
  it('expander: −60 dBFS goes down by (−45 − (−63))·1 = 18 dB, −20 dBFS untouched', () => {
    expect(Math.abs(gainDb(mk(expander, {}), 1000, -60) + 18)).toBeLessThan(1);
    expect(Math.abs(gainDb(mk(expander, {}), 1000, -20))).toBeLessThan(0.01);
  });
  it('clipper: 0 dBFS → ≤ −6 dBFS with ceiling −6; quiet material bit-identical', () => {
    expect(peakDb(run(mk(clipper, { ceiling: -6, knee: 3 })(), sine(200, 0)))).toBeLessThanOrEqual(-6 + 1e-6);
    const q = sine(200, -30);
    expect(run(mk(clipper, { ceiling: -6, knee: 3 })(), q)).toEqual(q);
  });
  it('transient shaper: 0/0 exact; +100 attack lifts the onset over the steady part', () => {
    const x = new Float32Array(SR); const s = sine(500, -12, 0.5);
    x.set(s, SR / 2);
    expect(run(mk(transient, {})(), x)).toEqual(x);
    const y = run(mk(transient, { attack: 100 })(), x);
    const onset = rmsDb(y, SR / 2, SR / 2 + 480) - rmsDb(x, SR / 2, SR / 2 + 480);
    const steady = rmsDb(y, SR - 4800, SR) - rmsDb(x, SR - 4800, SR);
    expect(onset - steady).toBeGreaterThan(3);
  });
  it('3-band comp: ratio 1 is flat across bands; a loud low tone is squashed, a loud high one is not', () => {
    for (const f of [100, 1000, 8000]) expect(Math.abs(gainDb(mk(mbcomp, { rl: 1, rm: 1, rh: 1 }), f))).toBeLessThan(0.1);
    expect(gainDb(mk(mbcomp, { tl: -30, rl: 4, th: 0, rh: 1, rm: 1 }), 100, -6)).toBeLessThan(-12);
    expect(Math.abs(gainDb(mk(mbcomp, { tl: -30, rl: 4, th: 0, rh: 1, rm: 1 }), 8000, -6))).toBeLessThan(0.3);
  });
  it('rider: evens loud/quiet sections and keeps alignment (latency compensated)', () => {
    const n = 6 * SR, x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = (Math.floor(i / SR) % 2 === 0 ? 0.45 : 0.045) * Math.sin((2 * Math.PI * 300 * i) / SR);
    const y = renderOffline(x, [{ id: 'rider', on: true, p: { target: -20, range: 6, speed: 200, gate: -45 } }], SR);
    expect(y.length).toBe(x.length);
    const d = (a: Float32Array, s: number) => rmsDb(a, s * SR + 24000, s * SR + 43000);
    expect((d(x, 2) - d(x, 3)) - (d(y, 2) - d(y, 3))).toBeGreaterThan(10);
    const imp = new Float32Array(20000); imp[9000] = 0.5;
    const z = renderOffline(imp, [{ id: 'rider', on: true, p: {} }], SR);
    expect(z[9000]).not.toBe(0);
  });
});

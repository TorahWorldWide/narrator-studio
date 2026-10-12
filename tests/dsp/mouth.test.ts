import { describe, it, expect } from 'vitest';
import { renderOffline } from '../../src/dsp/rack';
import { deplosive } from '../../src/dsp/modules/deplosive';
import type { ModuleDef } from '../../src/dsp/types';
import { SR, gainDb, peakDb, rmsDb, sine } from './util';

const mk = (def: ModuleDef, p: Record<string, number>) => () => { const q = def.create(SR, {}); q.setParams({ ...def.defaults(), ...p }); return q; };
function noise(n: number, amp: number, seed = 9) { const x = new Float32Array(n); let s = seed; for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; x[i] = ((s / 2 ** 32) * 2 - 1) * amp; } return x; }

describe('mouth group', () => {
  it('de-click: clean audio passes unchanged; injected clicks are removed', () => {
    const clean = sine(440, -12, 1);
    for (let i = 0; i < 480; i++) clean[clean.length - 1 - i] *= i / 480;   // real audio ends in silence
    expect(renderOffline(clean, [{ id: 'declick', on: true, p: {} }], SR)).toEqual(clean);
    const x = clean.slice();
    for (const at of [5000, 13000, 21000, 33000, 41000]) { x[at] += 0.7; x[at + 1] -= 0.5; }
    const y = renderOffline(x, [{ id: 'declick', on: true, p: {} }], SR);
    expect(peakDb(y)).toBeLessThan(-11);
    let err = 0; for (let i = 0; i < y.length; i++) err += (y[i] - clean[i]) ** 2;
    expect(10 * Math.log10(err / y.length)).toBeLessThan(-50);
  });
  it('de-plosive: a loud 60 Hz boom is squashed, 1 kHz is left', () => {
    expect(gainDb(mk(deplosive, { thresh: -30, ratio: 4 }), 60, -6)).toBeLessThan(-6);
    expect(Math.abs(gainDb(mk(deplosive, { thresh: -30, ratio: 4 }), 1000, -6))).toBeLessThan(0.1);
  });
  it('de-breath: a long quiet noise between "speech" is lowered by the range; a short one and the speech stay', () => {
    const tone = sine(200, -12, 0.5), x = new Float32Array(Math.round(2.2 * SR));
    x.set(tone, 0);
    x.set(noise(Math.round(0.4 * SR), 0.017), Math.round(0.5 * SR));        // breath ≈ −40 dB RMS, 400 ms
    x.set(tone, Math.round(0.9 * SR));
    x.set(noise(Math.round(0.05 * SR), 0.017, 3), Math.round(1.4 * SR));     // 50 ms "ה"
    x.set(tone.subarray(0, Math.round(0.5 * SR)), Math.round(1.45 * SR));
    const y = renderOffline(x, [{ id: 'debreath', on: true, p: { range: 12 } }], SR);
    expect(y.length).toBe(x.length);
    const seg = (a: Float32Array, t0: number, t1: number) => rmsDb(a, Math.round(t0 * SR), Math.round(t1 * SR));
    expect(Math.abs(seg(y, 0.6, 0.8) - seg(x, 0.6, 0.8) + 12)).toBeLessThan(1.5);
    expect(Math.abs(seg(y, 1.0, 1.3) - seg(x, 1.0, 1.3))).toBeLessThan(0.1);
    expect(Math.abs(seg(y, 1.405, 1.445) - seg(x, 1.405, 1.445))).toBeLessThan(0.5);
  });
});

import { describe, it, expect } from 'vitest';
import { RealFFT } from '../../src/dsp/fft';
import { pitch } from '../../src/dsp/modules/pitch';
import { renderOffline } from '../../src/dsp/rack';
import { sine } from './util';

const SR = 48000;
function dominantHz(x: Float32Array, from: number) {
  const n = 1 << 14, f = new RealFFT(n), w = new Float64Array(n), re = new Float64Array(n / 2 + 1), im = new Float64Array(n / 2 + 1);
  for (let i = 0; i < n; i++) w[i] = x[from + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  f.forward(w, re, im);
  let best = 1;
  for (let k = 1; k <= n / 2; k++) if (re[k] ** 2 + im[k] ** 2 > re[best] ** 2 + im[best] ** 2) best = k;
  return (best * SR) / n;
}

describe('pitch', () => {
  it('+12 st turns 440 Hz into ≈ 880 Hz; length kept after compensation; latency measured', () => {
    const x = sine(440, -6, 3);
    const y = renderOffline(x, [{ id: 'pitch', on: true, p: { semis: 12, cents: 0 } }], SR);
    expect(y.length).toBe(x.length);
    expect(Math.abs(dominantHz(y, SR) - 880)).toBeLessThan(10);
    const p = pitch.create(SR, {}); p.setParams({ semis: 12, cents: 0 });
    const L = p.latency();
    expect(L).toBeGreaterThan(16384);
    expect(p.latency()).toBe(L);
  });
  it('0 st keeps the tone where it was (lag-compensated)', () => {
    const x = sine(440, -6, 2);
    const y = renderOffline(x, [{ id: 'pitch', on: true, p: { semis: 0 } }], SR);
    expect(Math.abs(dominantHz(y, SR / 2) - 440)).toBeLessThan(10);
  });
});

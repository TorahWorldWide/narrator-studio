import { describe, it, expect } from 'vitest';
import { RealFFT } from '../../src/dsp/fft';
import { nr, computePrint, NR_BINS } from '../../src/dsp/modules/nr';
import { renderOffline } from '../../src/dsp/rack';

const SR = 48000;
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function gauss(r: () => number) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

/** Band power (dB) of x[from..from+2^15) with a Hann window. */
function bandDb(x: Float32Array, from: number, lo: number, hi: number) {
  const n = 1 << 15, f = new RealFFT(n), w = new Float64Array(n), re = new Float64Array(n / 2 + 1), im = new Float64Array(n / 2 + 1);
  for (let i = 0; i < n; i++) w[i] = x[from + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  f.forward(w, re, im);
  let s = 0;
  for (let k = Math.ceil((lo * n) / SR); k <= Math.floor((hi * n) / SR); k++) s += re[k] * re[k] + im[k] * im[k];
  return 10 * Math.log10(s + 1e-30);
}

describe('nr', () => {
  // 1 s noise only, then 2 s noise + 1 kHz tone
  const r = rng(42), x = new Float32Array(3 * SR);
  for (let i = 0; i < x.length; i++) {
    x[i] = 0.01 * gauss(r) + (i >= SR ? 0.1 * Math.sin((2 * Math.PI * 1000 * i) / SR) : 0);
  }
  const chain = [{ id: 'nr', on: true, p: { print: [0, 1], depth: 10, k: 1.5, smooth: true } }];
  const y = renderOffline(x, chain, SR);
  const from = Math.round(1.5 * SR);

  it('keeps the tone (≤ 1 dB) and lowers the 2–6 kHz noise floor ≥ 8 dB at depth 10', () => {
    expect(Math.abs(bandDb(y, from, 950, 1050) - bandDb(x, from, 950, 1050))).toBeLessThanOrEqual(1);
    expect(bandDb(x, from, 2000, 6000) - bandDb(y, from, 2000, 6000)).toBeGreaterThanOrEqual(8);
  });
  it('latency is 2048 and renderOffline keeps length and impulse position', () => {
    expect(nr.create(SR, {}).latency()).toBe(2048);
    expect(y.length).toBe(x.length);
    const imp = new Float32Array(20000); imp[7000] = 0.5;
    const z = renderOffline(imp, [{ id: 'nr', on: true, p: { depth: 10 } }], SR);
    let best = 0;
    for (let i = 0; i < z.length; i++) if (Math.abs(z[i]) > Math.abs(z[best])) best = i;
    expect(z.length).toBe(imp.length);
    expect(best).toBe(7000);
  });
  it('without a print it is a delayed near-perfect pass-through', () => {
    const p = nr.create(SR, {}); p.setParams(nr.defaults());
    const n = 8192, inp = new Float32Array(n); for (let i = 0; i < n; i++) inp[i] = Math.sin(i * 0.05) * 0.5;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 128) p.process(inp.subarray(i, i + 128), out.subarray(i, i + 128));
    for (let i = 2048; i < n; i++) expect(Math.abs(out[i] - inp[i - 2048])).toBeLessThan(1e-6);
  });
  it('computePrint returns one value per bin', () => {
    expect(computePrint(x, 'auto', 1.5).length).toBe(NR_BINS);
  });
});

import { describe, it, expect } from 'vitest';
import { RealFFT } from '../../src/dsp/fft';

describe('fft', () => {
  it('RealFFT matches a naive DFT and inverts', () => {
    const n = 64, x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = Math.sin(i * 0.37) + 0.5 * Math.cos(i * 1.9) + (i % 5) * 0.1;
    const f = new RealFFT(n), re = new Float64Array(n / 2 + 1), im = new Float64Array(n / 2 + 1);
    f.forward(x, re, im);
    for (let k = 0; k <= n / 2; k++) {
      let r = 0, q = 0;
      for (let t = 0; t < n; t++) { r += x[t] * Math.cos((2 * Math.PI * k * t) / n); q -= x[t] * Math.sin((2 * Math.PI * k * t) / n); }
      expect(re[k]).toBeCloseTo(r, 9); expect(im[k]).toBeCloseTo(q, 9);
    }
    const y = new Float64Array(n); f.inverse(re, im, y);
    for (let i = 0; i < n; i++) expect(y[i]).toBeCloseTo(x[i], 12);
  });
});

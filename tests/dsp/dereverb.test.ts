import { describe, it, expect } from 'vitest';
import { RealFFT } from '../../src/dsp/fft';
import { dereverb } from '../../src/dsp/modules/dereverb';
import { renderOffline } from '../../src/dsp/rack';
import { SR, rmsDb } from './util';

function lcg(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 2 ** 32) * 2 - 1; }; }
/** dry noise bursts (60 ms every 500 ms) convolved with an exponential-decay noise IR (RT60 0.6 s). */
function reverberant() {
  const n = 3 * SR, dry = new Float64Array(1 << 18), ir = new Float64Array(1 << 18), r = lcg(1), q = lcg(2);
  for (let i = 0; i < n; i++) dry[i] = i % (SR / 2) < 0.06 * SR ? 0.3 * r() : 0;
  ir[0] = 1;
  for (let i = 1; i < 0.8 * SR; i++) ir[i] = 0.08 * q() * Math.exp((-6.9 * i) / (0.6 * SR));
  const f = new RealFFT(1 << 18), b = (1 << 17) + 1;
  const ar = new Float64Array(b), ai = new Float64Array(b), br = new Float64Array(b), bi = new Float64Array(b);
  f.forward(dry, ar, ai); f.forward(ir, br, bi);
  for (let k = 0; k < b; k++) { const r2 = ar[k] * br[k] - ai[k] * bi[k], i2 = ar[k] * bi[k] + ai[k] * br[k]; ar[k] = r2; ai[k] = i2; }
  const y = new Float64Array(1 << 18); f.inverse(ar, ai, y);
  return Float32Array.from(y.subarray(0, n));
}

describe('dereverb', () => {
  it('lowers the reverb tail ≥ 4 dB, keeps the direct bursts within 3 dB, length + latency', () => {
    const x = reverberant();
    const y = renderOffline(x, [{ id: 'dereverb', on: true, p: {} }], SR);
    expect(y.length).toBe(x.length);
    expect(dereverb.create(SR, {}).latency()).toBe(2048);
    let tailX = 0, tailY = 0, burstX = 0, burstY = 0;
    for (let k = 1; k < 6; k++) {
      const s = k * (SR / 2);
      tailX += rmsDb(x, s + 0.15 * SR, s + 0.4 * SR); tailY += rmsDb(y, s + 0.15 * SR, s + 0.4 * SR);
      burstX += rmsDb(x, s + 0.005 * SR, s + 0.05 * SR); burstY += rmsDb(y, s + 0.005 * SR, s + 0.05 * SR);
    }
    expect((tailX - tailY) / 5).toBeGreaterThanOrEqual(4);
    expect(Math.abs(burstX - burstY) / 5).toBeLessThanOrEqual(3);
  });
});

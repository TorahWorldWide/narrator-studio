import { describe, it, expect } from 'vitest';
import { ainr } from '../../src/dsp/modules/ainr';
import { renderOffline } from '../../src/dsp/rack';
import { SR, rmsDb } from './util';

function noise(n: number, amp: number) { const x = new Float32Array(n); let s = 5; for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; x[i] = ((s / 2 ** 32) * 2 - 1) * amp; } return x; }

describe('ainr (RNNoise)', () => {
  // Real-audio check (not in CI, no corpus here): Genesis 1 original → quietest 15% of 100 ms frames −19.2 dB
  // median, loudest 30% −0.0 dB. Synthetic uniform white noise is not what the model was trained on (−1…−4 dB).
  it('latency 960; mix 0 is the input exactly after compensation; it processes; deterministic', () => {
    expect(ainr.create(SR, {}).latency()).toBe(960);
    const x = noise(2 * SR, 0.05);
    expect(renderOffline(x, [{ id: 'ainr', on: true, p: { mix: 0 } }], SR)).toEqual(x);
    const y = renderOffline(x, [{ id: 'ainr', on: true, p: { mix: 100 } }], SR);
    expect(y.length).toBe(x.length);
    expect(rmsDb(y, SR, 2 * SR)).toBeLessThan(rmsDb(x, SR, 2 * SR) - 0.5);
    expect(renderOffline(x, [{ id: 'ainr', on: true, p: { mix: 100 } }], SR)).toEqual(y);
  });
});

import { describe, it, expect } from 'vitest';
import { integratedLufs } from '../../src/dsp/lufs';
import { renderOffline } from '../../src/dsp/rack';
import { sine } from './util';

describe('loudness', () => {
  it('BS.1770: a 997 Hz sine at −20 dBFS peak reads −23.0 LUFS', () => {
    expect(Math.abs(integratedLufs(sine(997, -20, 5)) + 23.01)).toBeLessThan(0.05);
  });
  it('normalizes what reaches it (after a −6 dB gain) to the target', () => {
    const x = sine(997, -20, 5);
    const y = renderOffline(x, [{ id: 'gain', on: true, p: { gain: -6 } }, { id: 'loudness', on: true, p: { target: -19 } }], 48000);
    expect(y.length).toBe(x.length);
    expect(Math.abs(integratedLufs(y) + 19)).toBeLessThan(0.1);
  });
});

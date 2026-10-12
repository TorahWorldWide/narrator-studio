import { describe, it, expect } from 'vitest';
import { hum } from '../../src/dsp/modules/hum';
import { SR, gainDb } from './util';

const mk = () => { const h = hum.create(SR, {}); h.setParams({ freq: 61, harmonics: 3, q: 10, depth: 30 }); return h; };

describe('hum', () => {
  it('61 Hz with 3 harmonics: each ≥ 20 dB down at depth 30; 440 Hz within 0.3 dB', () => {
    for (const f of [61, 122, 183]) expect(gainDb(mk, f)).toBeLessThanOrEqual(-20);
    expect(Math.abs(gainDb(mk, 440))).toBeLessThanOrEqual(0.3);
  });
});

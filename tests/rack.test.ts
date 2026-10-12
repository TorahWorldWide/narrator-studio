import { describe, it, expect } from 'vitest';
import { Rack, renderOffline } from '../src/dsp/rack';
import type { ChainItem } from '../src/dsp/types';
import { sine } from './dsp/util';

const SR = 48000;
const noise = (n: number, seed = 1) => {
  const x = new Float32Array(n); let s = seed;
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; x[i] = ((s / 2 ** 32) * 2 - 1) * 0.5; }
  return x;
};
const chainA: ChainItem[] = [
  { id: 'hp', on: true, p: { freq: 120, order: 4 } },
  { id: 'eq', on: true, p: { b2freq: 1500, b2gain: 4, b2q: 1.4 } },
  { id: 'gate', on: true, p: { thresh: -40, range: 18 } },
  { id: 'comp', on: true, p: { thresh: -24, ratio: 3, knee: 4, makeup: 3 } },
  { id: 'gain', on: false, p: { gain: -6 } },
  { id: 'limiter', on: true, p: { ceiling: -2 } },
];

describe('rack.renderOffline', () => {
  it('impulse through [hp, limiter] stays at the same index; length preserved', () => {
    const x = new Float32Array(5000); x[1000] = 0.5;
    const chain: ChainItem[] = [{ id: 'hp', on: true, p: {} }, { id: 'limiter', on: true, p: {} }];
    const y = renderOffline(x, chain, SR);
    expect(y.length).toBe(x.length);
    let best = 0;
    for (let i = 1; i < y.length; i++) if (Math.abs(y[i]) > Math.abs(y[best])) best = i;
    expect(best).toBe(1000);
  });
  it('empty chain and all-off chain are bit-identical to the input', () => {
    const x = noise(10_000);
    expect(renderOffline(x, [], SR)).toEqual(x);
    expect(renderOffline(x, [{ id: 'comp', on: false, p: {} }], SR)).toEqual(x);
  });
  it('unknown ids are skipped as pass-through', () => {
    const x = noise(1000);
    expect(renderOffline(x, [{ id: 'nope', on: true, p: {} }], SR)).toEqual(x);
  });
  it('parity by blocks: renderOffline === manual 128-sample processing (bit-identical)', () => {
    const x = noise(48_000 + 77, 7);
    for (let i = 0; i < x.length; i++) x[i] += sine(440, -12, 1.1)[i] ?? 0;
    const a = renderOffline(x, chainA, SR, 128);
    const rack = new Rack(SR); rack.setContext({ source: x }); rack.setChain(chainA);
    const L = rack.latency();
    const n = Math.ceil((x.length + L) / 128) * 128;
    const padded = new Float32Array(n); padded.set(x);
    const out = new Float32Array(n);
    for (let s = 0; s < n; s += 128) { const xb = padded.slice(s, s + 128); rack.process(xb, out.subarray(s, s + 128)); }
    const b = out.slice(L, L + x.length);
    expect(a.length).toBe(x.length);
    expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer))).toBe(true);
  });
  it('bypass passes the input through', () => {
    const rack = new Rack(SR); rack.setChain(chainA); rack.bypass = true;
    const x = noise(128), y = new Float32Array(128);
    rack.process(x, y);
    expect(y).toEqual(x);
  });
  it('latency sums enabled modules only', () => {
    const rack = new Rack(SR); rack.setChain(chainA);
    expect(rack.latency()).toBe(240);
    rack.setOn(5, false);
    expect(rack.latency()).toBe(0);
  });
});

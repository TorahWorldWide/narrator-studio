import { describe, it, expect } from 'vitest';
import { room, roomIR } from '../../src/dsp/modules/room';
import { renderOffline } from '../../src/dsp/rack';
import { SR, rmsDb, sine } from './util';

describe('room (convolution)', () => {
  it('mix 0 is exact after compensation; an impulse returns the room IR (energy 1, decaying); length; latency', () => {
    expect(room.create(SR, {}).latency()).toBe(1024);
    const x = sine(300, -12, 1);
    expect(renderOffline(x, [{ id: 'room', on: true, p: { mix: 0 } }], SR)).toEqual(x);
    const imp = new Float32Array(3 * SR); imp[1000] = 1;
    const y = renderOffline(imp, [{ id: 'room', on: true, p: { room: 2, predelay: 0, mix: 100 } }], SR);
    expect(y.length).toBe(imp.length);
    const ir = roomIR(2, SR);
    let e = 0, maxErr = 0;
    for (let i = 0; i < ir.length; i++) { e += y[1000 + i] ** 2; maxErr = Math.max(maxErr, Math.abs(y[1000 + i] - ir[i])); }
    expect(Math.abs(e - 1)).toBeLessThan(1e-3);
    expect(maxErr).toBeLessThan(1e-5);
    expect(rmsDb(y, 1000 + 0.6 * SR, 1000 + 0.8 * SR)).toBeLessThan(rmsDb(y, 1000, 1000 + 0.1 * SR) - 15);
  });
  it('bigger rooms ring longer', () => {
    const late = (r: number) => { const h = roomIR(r, SR); let s = 0; for (let i = Math.round(0.3 * SR); i < h.length; i++) s += h[i] ** 2; return s; };
    expect(late(3)).toBeGreaterThan(late(0));
  });
});

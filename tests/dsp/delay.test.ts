import { describe, it, expect } from 'vitest';
import { delay } from '../../src/dsp/modules/delay';
import { SR, run, sine } from './util';

describe('delay', () => {
  it('mix 0 is bit-identical; an impulse echoes after `time` with feedback decay; length kept', () => {
    const x = sine(300, -6);
    const a = delay.create(SR, {}); a.setParams({ time: 250, feedback: 30, mix: 0 });
    expect(run(a, x)).toEqual(x);
    const imp = new Float32Array(SR); imp[0] = 1;
    const b = delay.create(SR, {}); b.setParams({ time: 100, feedback: 50, mix: 100 });
    const y = run(b, imp);
    expect(y.length).toBe(imp.length);
    expect(y[4800]).toBeCloseTo(1, 6);
    expect(y[9600]).toBeCloseTo(0.5, 6);
    expect(y[0]).toBe(0);
  });
});

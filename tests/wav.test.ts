import { describe, it, expect } from 'vitest';
import { encodeWav, toPcm16 } from '../src/dsp/wav';

describe('wav', () => {
  it('writes a valid 48 kHz mono PCM16 header and clamps', () => {
    const x = new Float32Array([0, 0.5, -0.5, 1.2, -1.2]);
    const b = encodeWav(x, 48000, 'pcm16');
    const v = new DataView(b);
    expect(b.byteLength).toBe(44 + 10);
    expect(String.fromCharCode(...new Uint8Array(b, 0, 4))).toBe('RIFF');
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(Array.from(new Int16Array(b, 44))).toEqual([0, 16384, -16383, 32767, -32767]);
    expect(Array.from(toPcm16(x))).toEqual([0, 16384, -16383, 32767, -32767]);
  });
  it('float32 format keeps samples exactly', () => {
    const x = new Float32Array([0.1, -0.25]);
    expect(Array.from(new Float32Array(encodeWav(x, 48000, 'float32'), 44))).toEqual(Array.from(x));
  });
});

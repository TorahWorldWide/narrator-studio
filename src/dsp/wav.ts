/** Float32 mono/interleaved → WAV bytes (RIFF, PCM16 or IEEE float32). */
export type WavFormat = 'pcm16' | 'float32';

/** The exact float → int16 rule used everywhere (browser render, Node render, parity hashes). */
export function toPcm16(x: Float32Array): Int16Array {
  const out = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const v = x[i] > 1 ? 1 : x[i] < -1 ? -1 : x[i];
    out[i] = Math.round(v * 32767);
  }
  return out;
}

export function encodeWav(x: Float32Array, sr = 48000, format: WavFormat = 'pcm16', channels = 1): ArrayBuffer {
  const bps = format === 'pcm16' ? 2 : 4;
  const dataBytes = x.length * bps;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + dataBytes, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, format === 'pcm16' ? 1 : 3, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * channels * bps, true);
  v.setUint16(32, channels * bps, true);
  v.setUint16(34, bps * 8, true);
  str(36, 'data'); v.setUint32(40, dataBytes, true);
  if (format === 'pcm16') new Int16Array(buf, 44).set(toPcm16(x));
  else new Float32Array(buf, 44).set(x);
  return buf;
}

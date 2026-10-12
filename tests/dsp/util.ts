export const SR = 48000;
export function sine(freq: number, db: number, secs = 1, sr = SR): Float32Array {
  const a = Math.pow(10, db / 20), n = Math.round(secs * sr), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = a * Math.sin((2 * Math.PI * freq * i) / sr);
  return x;
}
export function rmsDb(x: Float32Array, from = 0, to = x.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return 10 * Math.log10(s / (to - from) + 1e-30);
}
export function peakDb(x: Float32Array, from = 0, to = x.length): number {
  let m = 0;
  for (let i = from; i < to; i++) m = Math.max(m, Math.abs(x[i]));
  return 20 * Math.log10(m + 1e-30);
}
/** Run a processor over x in 128-sample blocks (like the worklet), returns a new array. */
export function run(proc: { process(x: Float32Array, y: Float32Array): void }, x: Float32Array, block = 128): Float32Array {
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i += block) proc.process(x.subarray(i, i + block), y.subarray(i, i + block));
  return y;
}
/** Gain change in dB of `proc` on a 1 s sine, measured over the second half (skips transients). */
export function gainDb(mk: () => { process(x: Float32Array, y: Float32Array): void }, freq: number, db = -6): number {
  const x = sine(freq, db), y = run(mk(), x), h = x.length >> 1;
  return rmsDb(y, h) - rmsDb(x, h);
}

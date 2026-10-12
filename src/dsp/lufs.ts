/** ITU-R BS.1770-4 integrated loudness (mono, 48 kHz K-weighting, 400 ms blocks / 100 ms hop, −70 and −10 LU gates). */
const K1 = { b0: 1.53512485958697, b1: -2.69169618940638, b2: 1.19839281085285, a1: -1.69065929318241, a2: 0.73248077421585 };
const K2 = { b0: 1, b1: -2, b2: 1, a1: -1.99004745483398, a2: 0.99007225036621 };

export function integratedLufs(x: Float32Array, sr = 48000): number {
  if (sr !== 48000) throw new Error('integratedLufs: 48 kHz only');
  const n = x.length, k = new Float64Array(n);
  let z1 = 0, z2 = 0, w1 = 0, w2 = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    const a = K1.b0 * v + z1; z1 = K1.b1 * v - K1.a1 * a + z2; z2 = K1.b2 * v - K1.a2 * a;
    const b = K2.b0 * a + w1; w1 = K2.b1 * a - K2.a1 * b + w2; w2 = K2.b2 * a - K2.a2 * b;
    k[i] = b * b;
  }
  const B = Math.round(0.4 * sr), H = Math.round(0.1 * sr);
  const blocks: number[] = [];
  let s = 0;
  for (let i = 0; i < Math.min(B, n); i++) s += k[i];
  for (let start = 0; start + B <= n; start += H) {
    if (start > 0) { for (let i = start - H; i < start; i++) s -= k[i]; for (let i = start + B - H; i < start + B; i++) s += k[i]; }
    blocks.push(s / B);
  }
  if (!blocks.length) return -Infinity;
  const L = (ms: number) => -0.691 + 10 * Math.log10(ms);
  const abs = blocks.filter((m) => L(m) > -70);
  if (!abs.length) return -Infinity;
  const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((m) => L(m) > rel);
  return L(gated.reduce((a, b) => a + b, 0) / gated.length);
}

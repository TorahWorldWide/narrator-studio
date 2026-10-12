/** Radix-2 FFTs on Float64Array. `FFT` is complex in-place; `RealFFT` packs a real n-point
 *  transform into an n/2-point complex one. Forward is unscaled, inverse scales by 1/n. */
export class FFT {
  readonly n: number;
  private rev: Uint32Array; private cos: Float64Array; private sin: Float64Array;
  constructor(n: number) {
    if (n < 2 || (n & (n - 1)) !== 0) throw new Error(`FFT size must be a power of two: ${n}`);
    this.n = n;
    const bits = Math.log2(n);
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(n / 2); this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) { this.cos[i] = Math.cos((2 * Math.PI * i) / n); this.sin[i] = Math.sin((2 * Math.PI * i) / n); }
  }
  /** In-place; inverse includes the 1/n scale. */
  transform(re: Float64Array, im: Float64Array, inverse = false) {
    const n = this.n, rev = this.rev, C = this.cos, S = this.sin, sg = inverse ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const c = C[k], s = sg * S[k], xr = re[j + half], xi = im[j + half];
          const tr = xr * c + xi * s, ti = xi * c - xr * s;
          re[j + half] = re[j] - tr; im[j + half] = im[j] - ti;
          re[j] += tr; im[j] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

export class RealFFT {
  readonly n: number; readonly bins: number;
  private m: number; private fft: FFT;
  private zr: Float64Array; private zi: Float64Array;
  private wc: Float64Array; private ws: Float64Array;
  constructor(n: number) {
    this.n = n; this.m = n / 2; this.bins = n / 2 + 1;
    this.fft = new FFT(this.m);
    this.zr = new Float64Array(this.m); this.zi = new Float64Array(this.m);
    this.wc = new Float64Array(this.bins); this.ws = new Float64Array(this.bins);
    for (let k = 0; k < this.bins; k++) { this.wc[k] = Math.cos((2 * Math.PI * k) / n); this.ws[k] = Math.sin((2 * Math.PI * k) / n); }
  }
  /** x (length n) → re/im (length n/2+1). */
  forward(x: ArrayLike<number>, re: Float64Array, im: Float64Array) {
    const m = this.m, zr = this.zr, zi = this.zi;
    for (let k = 0; k < m; k++) { zr[k] = x[2 * k]; zi[k] = x[2 * k + 1]; }
    this.fft.transform(zr, zi);
    for (let k = 0; k <= m; k++) {
      const a = k % m, b = (m - k) % m;
      const er = (zr[a] + zr[b]) / 2, ei = (zi[a] - zi[b]) / 2;
      const or = (zi[a] + zi[b]) / 2, oi = -(zr[a] - zr[b]) / 2;
      const c = this.wc[k], s = this.ws[k];
      re[k] = er + or * c + oi * s;
      im[k] = ei + oi * c - or * s;
    }
  }
  /** re/im (length n/2+1) → x (length n). */
  inverse(re: Float64Array, im: Float64Array, x: Float64Array | Float32Array) {
    const m = this.m, zr = this.zr, zi = this.zi;
    for (let k = 0; k < m; k++) {
      const br = re[m - k], bi = -im[m - k];             // conj(X[m−k])
      const er = (re[k] + br) / 2, ei = (im[k] + bi) / 2;
      const dr = (re[k] - br) / 2, di = (im[k] - bi) / 2; // W·O
      const c = this.wc[k], s = this.ws[k];               // O = conj(W)·(W·O)
      const or = dr * c - di * s, oi = di * c + dr * s;
      zr[k] = er - oi; zi[k] = ei + or;                   // Z = E + i·O
    }
    this.fft.transform(zr, zi, true);
    for (let k = 0; k < m; k++) { x[2 * k] = zr[k]; x[2 * k + 1] = zi[k]; }
  }
}

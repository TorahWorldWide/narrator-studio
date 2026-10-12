import { RealFFT } from './fft';

/**
 * Streaming STFT (N=2048, hop 512, sqrt-Hann analysis + synthesis, overlap-add / 2) on any block size.
 * A frame is analysed at every hop boundary from the last N inputs; `onFrame` edits the spectrum in place;
 * output is the resynthesis delayed by exactly N samples. (Same framing as nr.ts.)
 */
export const STFT_N = 2048, STFT_H = 512, STFT_BINS = STFT_N / 2 + 1;
const WIN = (() => { const w = new Float64Array(STFT_N); for (let i = 0; i < STFT_N; i++) w[i] = Math.sin((Math.PI * i) / STFT_N); return w; })();

export class Stft {
  private fft = new RealFFT(STFT_N);
  private ring = new Float64Array(STFT_N); private out = new Float64Array(2 * STFT_N);
  private frame = new Float64Array(STFT_N); private re = new Float64Array(STFT_BINS); private im = new Float64Array(STFT_BINS);
  private n = 0; private fill = 0;
  private onFrame: (re: Float64Array, im: Float64Array) => void;
  constructor(onFrame: (re: Float64Array, im: Float64Array) => void) { this.onFrame = onFrame; }
  process(x: Float32Array, y: Float32Array) {
    const M = 2 * STFT_N - 1;
    for (let i = 0; i < x.length; i++) {
      this.ring[this.n & (STFT_N - 1)] = x[i];
      if (++this.fill === STFT_H) { this.fill = 0; this.frameDone(); }
      const p = (this.n - STFT_N) & M;
      y[i] = this.n >= STFT_N ? this.out[p] : 0;
      this.out[p] = 0;
      this.n++;
    }
  }
  private frameDone() {
    const start = this.n - STFT_N + 1, M = 2 * STFT_N - 1;
    for (let i = 0; i < STFT_N; i++) this.frame[i] = this.ring[(start + i) & (STFT_N - 1)] * WIN[i];
    this.fft.forward(this.frame, this.re, this.im);
    this.onFrame(this.re, this.im);
    this.fft.inverse(this.re, this.im, this.frame);
    for (let i = 0; i < STFT_N; i++) this.out[(start + i) & M] += (this.frame[i] * WIN[i]) / 2;
  }
  reset() { this.ring.fill(0); this.out.fill(0); this.n = 0; this.fill = 0; }
}

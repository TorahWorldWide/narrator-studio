import { RealFFT } from '../fft';
import type { ModuleContext, ModuleDef, Processor } from '../types';
import { num } from '../util';

/**
 * Spectral subtraction (port of ~/hum/scripts/specgate.py `print`, direction ב׳):
 * STFT N=2048 hop=512 sqrt-Hann; noise print = per-bin mean + k·std of |X|² over the print frames;
 * power mask = clamp(1 − noise/P, 0, 1), optionally box-smoothed over 5 bins × 3 frames,
 * amplitude gain = sqrt(max(mask, floor²)) with floor = 10^(−depth/20); overlap-add with the
 * window-squared normalisation (constant 2 at hop N/4).
 * Streaming on 128-sample blocks: a frame is analysed at every hop boundary from the last N inputs;
 * output is delayed by exactly N samples. The 3-frame smoothing is causal (current + 2 previous
 * frames) so the latency stays N; specgate's centred smoothing would need one more hop.
 */
export const NR_N = 2048, NR_H = 512, NR_BINS = NR_N / 2 + 1;
export type PrintMode = 'auto' | [number, number];
export interface NrP { print: PrintMode; depth: number; k: number; smooth: boolean }
const DEF: NrP = { print: 'auto', depth: 10, k: 1.5, smooth: true };

const WIN = (() => { const w = new Float64Array(NR_N); for (let i = 0; i < NR_N; i++) w[i] = Math.sin((Math.PI * i) / NR_N); return w; })();

export const printKey = (p: unknown) => (Array.isArray(p) && p.length === 2 ? `${Number(p[0])}:${Number(p[1])}` : 'auto');
export const isRegion = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v)) && p[1] > p[0];

function percentile(sorted: Float64Array, q: number) {   // numpy 'linear'
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.min(sorted.length - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Noise-print statistics from the whole source: Float32Array(2·BINS) = [mean |X|² | std |X|²].
 * `auto` = frames whose energy ≤ the 15th percentile; [t0, t1] = frames inside that region (seconds).
 */
export function printStats(source: Float32Array, mode: PrintMode, sr = 48000): Float32Array {
  const len = source.length;
  const nFrames = len >= NR_N ? 1 + Math.floor((len - NR_N) / NR_H) : 1;
  const frame = new Float64Array(NR_N);
  const fill = (m: number) => {
    const s = m * NR_H;
    for (let i = 0; i < NR_N; i++) { const j = s + i; frame[i] = j < len ? source[j] * WIN[i] : 0; }
  };
  let pick: number[] = [];
  if (isRegion(mode)) {
    const a = Math.max(0, Math.round(mode[0] * sr)), b = Math.min(len, Math.round(mode[1] * sr));
    for (let m = 0; m < nFrames; m++) { const s = m * NR_H; if (s >= a && s + NR_N <= b) pick.push(m); }
    if (!pick.length) pick = [Math.min(nFrames - 1, Math.floor(a / NR_H))];
  } else {
    const e = new Float64Array(nFrames);
    for (let m = 0; m < nFrames; m++) { fill(m); let s = 0; for (let i = 0; i < NR_N; i++) s += frame[i] * frame[i]; e[m] = s; }
    const thr = percentile(Float64Array.from(e).sort(), 0.15);
    for (let m = 0; m < nFrames; m++) if (e[m] <= thr) pick.push(m);
  }
  const fft = new RealFFT(NR_N), re = new Float64Array(NR_BINS), im = new Float64Array(NR_BINS);
  const sum = new Float64Array(NR_BINS), sq = new Float64Array(NR_BINS);
  for (const m of pick) {
    fill(m); fft.forward(frame, re, im);
    for (let b = 0; b < NR_BINS; b++) { const p = re[b] * re[b] + im[b] * im[b]; sum[b] += p; sq[b] += p * p; }
  }
  const out = new Float32Array(2 * NR_BINS), n = pick.length;
  for (let b = 0; b < NR_BINS; b++) {
    const mean = sum[b] / n;
    out[b] = mean;
    out[NR_BINS + b] = Math.sqrt(Math.max(0, sq[b] / n - mean * mean));
  }
  return out;
}

/** Per-bin noise power (mean + k·std) — the print exactly as the processor uses it. */
export function computePrint(source: Float32Array, mode: PrintMode, k: number, sr = 48000): Float32Array {
  const st = printStats(source, mode, sr), out = new Float32Array(NR_BINS);
  for (let b = 0; b < NR_BINS; b++) out[b] = st[b] + k * st[NR_BINS + b];
  return out;
}

class NrProc implements Processor<NrP> {
  private ctx: ModuleContext;
  private stats: Float32Array | null = null; private statsKey = '';
  private noise = new Float64Array(NR_BINS);
  private floor2 = 0.1; private k = DEF.k; private smooth = DEF.smooth;
  private fft = new RealFFT(NR_N);
  private inRing = new Float64Array(NR_N); private n = 0; private fill = 0;
  private out = new Float64Array(2 * NR_N);
  private frame = new Float64Array(NR_N); private re = new Float64Array(NR_BINS); private im = new Float64Array(NR_BINS);
  private raw = [new Float64Array(NR_BINS), new Float64Array(NR_BINS), new Float64Array(NR_BINS)]; private rawIdx = 0;
  private m3 = new Float64Array(NR_BINS);

  constructor(ctx: ModuleContext) { this.ctx = ctx; this.raw.forEach((r) => r.fill(1)); }

  setParams(p: Partial<NrP>) {
    this.floor2 = Math.pow(10, -num(p.depth, DEF.depth) / 10);
    this.k = num(p.k, DEF.k);
    this.smooth = p.smooth === undefined ? DEF.smooth : !!p.smooth;
    const mode: PrintMode = isRegion(p.print) ? p.print : 'auto';
    const key = printKey(mode);
    if (this.ctx.source && key !== this.statsKey) { this.stats = printStats(this.ctx.source, mode); this.statsKey = key; }
    this.updateNoise();
  }
  /** Host-supplied print statistics (from printStats) — used where the source is not available (worklet). */
  setPrint(d: Float32Array) { if (d.length === 2 * NR_BINS) { this.stats = d; this.statsKey = ''; this.updateNoise(); } }
  private updateNoise() {
    const st = this.stats;
    for (let b = 0; b < NR_BINS; b++) this.noise[b] = st ? st[b] + this.k * st[NR_BINS + b] : 0;
  }

  private frameDone() {
    const { frame, re, im, inRing, noise } = this;
    const start = this.n - NR_N + 1;                       // absolute index of the frame's first sample
    for (let i = 0; i < NR_N; i++) frame[i] = inRing[(start + i) & (NR_N - 1)] * WIN[i];
    this.fft.forward(frame, re, im);
    const cur = this.raw[this.rawIdx];
    for (let b = 0; b < NR_BINS; b++) {
      const P = re[b] * re[b] + im[b] * im[b];
      const m = noise[b] > 0 ? 1 - noise[b] / Math.max(P, 1e-30) : 1;
      cur[b] = m < 0 ? 0 : m > 1 ? 1 : m;
    }
    let mask = cur;
    if (this.smooth) {
      const [a, b2, c] = this.raw, m3 = this.m3;
      for (let b = 0; b < NR_BINS; b++) m3[b] = (a[b] + b2[b] + c[b]) / 3;
      mask = this.frame;                                   // reuse as scratch (frame data no longer needed)
      for (let b = 0; b < NR_BINS; b++) {
        let s = 0;
        for (let d = -2; d <= 2; d++) { const j = b + d; s += m3[j < 0 ? 0 : j >= NR_BINS ? NR_BINS - 1 : j]; }
        mask[b] = s / 5;
      }
    }
    const f2 = this.floor2;
    for (let b = 0; b < NR_BINS; b++) { const g = Math.sqrt(mask[b] > f2 ? mask[b] : f2); re[b] *= g; im[b] *= g; }
    this.rawIdx = (this.rawIdx + 1) % 3;
    const y = this.frame;
    this.fft.inverse(re, im, y);
    const out = this.out, M = 2 * NR_N - 1;
    for (let i = 0; i < NR_N; i++) out[(start + i) & M] += (y[i] * WIN[i]) / 2;
  }

  process(x: Float32Array, y: Float32Array) {
    const ring = this.inRing, out = this.out, M = 2 * NR_N - 1;
    for (let i = 0; i < x.length; i++) {
      ring[this.n & (NR_N - 1)] = x[i];
      if (++this.fill === NR_H) { this.fill = 0; this.frameDone(); }
      const p = (this.n - NR_N) & M;                      // emit z[n − N]
      y[i] = this.n >= NR_N ? out[p] : 0;
      out[p] = 0;
      this.n++;
    }
  }
  latency() { return NR_N; }
  reset() {
    this.inRing.fill(0); this.out.fill(0); this.n = 0; this.fill = 0;
    this.raw.forEach((r) => r.fill(1)); this.rawIdx = 0;
  }
}

export const nr: ModuleDef<NrP> = {
  id: 'nr', he: 'הפחתת רעש', en: 'Noise reduction',
  blurb: 'לומד את הרעש מההפסקות ומוריד אותו גם מתחת לקול (כיוון ב׳)',
  params: [
    { key: 'depth', he: 'עומק', en: 'Depth', min: 0, max: 30, def: 10, step: 0.5, unit: 'dB', scale: 'lin' },
    { key: 'k', he: 'רגישות', en: 'k (σ)', min: 0, max: 3, def: 1.5, step: 0.05, unit: '', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (_sr, ctx) => new NrProc(ctx),
};

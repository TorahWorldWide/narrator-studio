// npm run qa -- --ref in.mp3 --out out.wav [--recipe r.json]
// → {len_ref, len_out, lag_samples, lag_broadband, peak_ref, peak_out, lufs_ref, lufs_out}; exit 1 on a length
//   mismatch, or when |lag| (2–6 kHz speech band) > LAG_TOLERANCE (1 ms) for a chain without pitch.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { BUTTER_Q, Cascade, highpass, lowpass } from '../src/dsp/biquad';
import { RealFFT } from '../src/dsp/fft';
import { decode } from './decode';
import { args } from './render';

const SR = 48000;
/** Pass threshold for chains without pitch: 1 ms. Minimum-phase EQ/filters/crossovers move the
 *  speech-band cross-correlation peak by a few samples (phase, not time); every real latency error
 *  is ≥ 240 samples (the smallest module latency), and word-sync works at ~10 ms. */
export const LAG_TOLERANCE = 48;

export function lufs(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-nostats', '-hide_banner', '-i', path, '-af', 'ebur128=framelog=verbose', '-f', 'null', '-']);
    let err = '';
    p.stderr.on('data', (c: Buffer) => { err += c.toString(); });
    p.on('error', reject);
    p.on('close', () => {
      const m = [...err.matchAll(/^\s*I:\s*(-?[\d.]+|-inf)\s*LUFS/gm)].pop();
      resolve(m ? Number(m[1] === '-inf' ? -Infinity : m[1]) : NaN);
    });
  });
}

/** Lag (samples) of `out` vs `ref` by FFT cross-correlation on the loudest 10 s of `ref`. */
export function lagSamples(ref: Float32Array, out: Float32Array, maxLag = SR): number {
  const win = Math.min(10 * SR, ref.length);
  let best = 0, bestE = -1;
  for (let s = 0; s + win <= ref.length; s += SR) {             // loudest 10 s, 1 s steps
    let e = 0; for (let i = s; i < s + win; i += 4) e += ref[i] * ref[i];
    if (e > bestE) { bestE = e; best = s; }
  }
  let n = 1; while (n < 2 * win + 2 * maxLag) n <<= 1;
  const f = new RealFFT(n), bins = n / 2 + 1;
  const a = new Float64Array(n), b = new Float64Array(n);
  for (let i = 0; i < win; i++) a[i] = ref[best + i];
  for (let i = -maxLag; i < win + maxLag; i++) { const j = best + i; b[i + maxLag] = j >= 0 && j < out.length ? out[j] : 0; }
  const ar = new Float64Array(bins), ai = new Float64Array(bins), br = new Float64Array(bins), bi = new Float64Array(bins);
  f.forward(a, ar, ai); f.forward(b, br, bi);
  for (let k = 0; k < bins; k++) { const r = br[k] * ar[k] + bi[k] * ai[k], q = bi[k] * ar[k] - br[k] * ai[k]; br[k] = r; bi[k] = q; }
  const c = new Float64Array(n); f.inverse(br, bi, c);           // c[t] = Σ a[i]·b[i+t]
  let bt = 0, bc = -Infinity;
  for (let t = 0; t <= 2 * maxLag; t++) if (c[t] > bc) { bc = c[t]; bt = t; }
  return bt - maxLag;
}

/**
 * Speech band 2–6 kHz (Butterworth 4 + 4), applied identically to both files before the lag search.
 * Minimum-phase filters in a chain (hp 95 Hz order 4: ≈ −7 samples broadband) shift the low-frequency
 * phase, which a broadband cross-correlation reads as "lag"; in 2–6 kHz that phase shift is < 1 sample,
 * while any true time shift (latency bug) shows up unchanged.
 */
export function speechBand(x: Float32Array, sr = SR): Float32Array {
  const c = new Cascade();
  c.setAll([...BUTTER_Q[4].map((q) => highpass(sr, 2000, q)), ...BUTTER_Q[4].map((q) => lowpass(sr, 6000, q))]);
  const y = new Float32Array(x.length);
  c.process(x, y);
  return y;
}

const peakDb = (x: Float32Array) => { let m = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > m) m = v; } return Number((m > 1e-10 ? 20 * Math.log10(m) : -200).toFixed(2)); };

export async function qa(refPath: string, outPath: string, hasPitch = false) {
  const [ref, out] = await Promise.all([decode(refPath), decode(outPath)]);
  const [lufs_ref, lufs_out] = await Promise.all([lufs(refPath), lufs(outPath)]);
  const r = {
    len_ref: ref.length, len_out: out.length, lag_samples: lagSamples(speechBand(ref), speechBand(out)),
    lag_broadband: lagSamples(ref, out),
    peak_ref: peakDb(ref), peak_out: peakDb(out), lufs_ref, lufs_out,
  };
  const ok = r.len_ref === r.len_out && (hasPitch || Math.abs(r.lag_samples) <= LAG_TOLERANCE);
  return { ...r, ok };
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.ref || !a.out) { console.error('usage: npm run qa -- --ref in.mp3 --out out.wav [--recipe r.json]'); process.exit(2); }
  const hasPitch = a.recipe ? JSON.parse(readFileSync(a.recipe, 'utf8')).chain?.some((c: { id: string; on: boolean }) => c.id === 'pitch' && c.on) : false;
  const r = await qa(a.ref, a.out, hasPitch);
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}

if (process.argv[1] && /qa\.ts$/.test(process.argv[1])) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });

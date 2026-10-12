import { SimpleFilter, SoundTouch } from 'soundtouchjs';
import type { ModuleDef, Processor } from '../types';
import { num } from '../util';

interface PitchP { semis: number; cents: number }
const DEF: PitchP = { semis: 0, cents: 0 };

/** SimpleFilter only processes once 16384 input frames are buffered, so output arrives in bursts;
 *  emitting with this fixed delay keeps the output queue from ever running dry. */
const EMIT = 16384 + 8192;

/** Growable FIFO of mono samples. */
class Fifo {
  buf = new Float32Array(1 << 15); start = 0; end = 0;
  get length() { return this.end - this.start; }
  push(x: ArrayLike<number>, n = x.length, stride = 1) {
    if (this.end + n > this.buf.length) {
      const len = this.length;
      if (len + n <= this.buf.length) this.buf.copyWithin(0, this.start, this.end);
      else { const nb = new Float32Array((len + n) * 2); nb.set(this.buf.subarray(this.start, this.end)); this.buf = nb; }
      this.start = 0; this.end = len;
    }
    for (let i = 0; i < n; i++) this.buf[this.end + i] = x[i * stride];
    this.end += n;
  }
  shift() { return this.buf[this.start++]; }
  drop(n: number) { this.start += Math.min(n, this.length); }
  at(i: number) { return this.buf[this.start + i]; }
}

/** soundtouchjs pitch shift with tempo 1 (duration kept), mono via interleaved stereo. */
class PitchProc implements Processor<PitchP> {
  private sr: number; private st: SoundTouch; private filter: SimpleFilter;
  private inQ = new Fifo(); private outQ = new Fifo(); private outBase = 0; // index of outQ[0] in the output stream
  private produced = 0; private n = 0; private tmp = new Float32Array(2 * 4096);
  private shift = 0;
  constructor(sr: number) {
    this.sr = sr;
    this.st = new SoundTouch();
    this.st.stretch.setParameters(sr, 0, 0, 8);
    this.st.tempo = 1;
    this.st.pitchSemitones = 0;
    const q = this.inQ;
    this.filter = new SimpleFilter({
      extract: (target, numFrames) => {
        const k = Math.min(numFrames, q.length);
        for (let i = 0; i < k; i++) { const v = q.shift(); target[2 * i] = v; target[2 * i + 1] = v; }
        return k;
      },
    }, this.st);
  }
  get semitones() { return this.shift; }
  setParams(p: Partial<PitchP>) {
    const s = num(p.semis, DEF.semis) + num(p.cents, DEF.cents) / 100;
    if (s !== this.shift) { this.shift = s; this.st.pitchSemitones = s; }
  }
  process(x: Float32Array, y: Float32Array) {
    this.inQ.push(x);
    for (;;) {
      const k = this.filter.extract(this.tmp, 4096);
      if (!k) break;
      this.outQ.push(this.tmp, k, 2);
      this.produced += k;
    }
    for (let i = 0; i < x.length; i++, this.n++) {
      const m = this.n - EMIT;                       // output-stream index to emit now
      if (m < 0 || m >= this.produced) { y[i] = 0; continue; }
      const off = m - this.outBase;
      if (off > 0) { this.outQ.drop(off); this.outBase += off; }
      y[i] = this.outQ.shift(); this.outBase++;
    }
  }
  /** Impulse delay of this exact pipeline for the current pitch, measured once per setting. */
  latency() { return measureLatency(this.sr, this.shift); }
  reset() { /* stateful library pipeline: the rack recreates the module instead */ }
}

const latencyCache = new Map<string, number>();
/**
 * Delay of this exact pipeline for a pitch setting, measured once per setting. A lone impulse is not
 * reliable here (the first overlap fades it out; at tempo ≠ 1 the stretch may skip or repeat it), so
 * we cross-correlate the amplitude envelopes of an amplitude-modulated noise probe (16-sample steps).
 */
function measureLatency(sr: number, semis: number): number {
  const key = `${sr}|${semis}`;
  const hit = latencyCache.get(key);
  if (hit !== undefined) return hit;
  const p = new PitchProc(sr);
  p.setParams({ semis, cents: 0 });
  const lead = Math.round(0.25 * sr), body = Math.round(2 * sr), maxLag = EMIT + 16384;
  const n = Math.ceil((lead + body + maxLag) / 128) * 128;
  const x = new Float32Array(n), y = new Float32Array(n);
  let s = 12345;
  for (let i = lead; i < lead + body; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    const t = i / sr, env = Math.abs(Math.sin(2 * Math.PI * 3.1 * t) * Math.sin(2 * Math.PI * 7.3 * t + 1) + 0.6 * Math.sin(2 * Math.PI * 13.7 * t + 2));
    x[i] = env * ((s / 2 ** 32) * 2 - 1) * 0.5;
  }
  for (let i = 0; i < n; i += 128) p.process(x.subarray(i, i + 128), y.subarray(i, i + 128));
  const H = 16, W = 64, frames = Math.floor((n - W) / H);
  const envOf = (a: Float32Array) => {
    const e = new Float64Array(frames);
    for (let f = 0; f < frames; f++) { let q = 0; for (let i = 0; i < W; i++) { const v = a[f * H + i]; q += v * v; } e[f] = Math.sqrt(q / W); }
    return e;
  };
  const ex = envOf(x), ey = envOf(y);
  const f0 = Math.floor(lead / H), f1 = Math.floor((lead + body) / H);
  let best = 0, bestC = -Infinity;
  for (let lag = 0; lag <= Math.floor(maxLag / H) && f1 + lag < frames; lag++) {
    let c = 0;
    for (let f = f0; f < f1; f++) c += ex[f] * ey[f + lag];
    if (c > bestC) { bestC = c; best = lag; }
  }
  const L = best * H;
  latencyCache.set(key, L);
  return L;
}

export const PITCH_WARNING = 'לא לאתר החי — הסנכרון עלול לזוז';

export const pitch: ModuleDef<PitchP> = {
  id: 'pitch', he: 'גובה', en: 'Pitch',
  blurb: 'מגביה או מנמיך את הקול בלי לשנות את המהירות',
  params: [
    { key: 'semis', he: 'חצאי טונים', en: 'Semitones', min: -12, max: 12, def: 0, step: 1, unit: 'st', scale: 'lin' },
    { key: 'cents', he: 'סנטים', en: 'Cents', min: -100, max: 100, def: 0, step: 1, unit: '', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new PitchProc(sr),
  experimental: true,
};

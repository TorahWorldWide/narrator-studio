import { RealFFT } from '../fft';
import type { ModuleDef, Processor } from '../types';
import { Smoother, num } from '../util';

interface RoomP { room: number; predelay: number; mix: number }
const DEF: RoomP = { room: 2, predelay: 10, mix: 25 };
const B = 1024, N = 2 * B, BINS = B + 1;

/** Computed (not recorded) rooms: early reflections + a diffuse tail that decays faster in the highs. */
export const ROOMS = [
  { he: 'חדר קטן', rt60: 0.35, size: 0.5 },
  { he: 'סטודיו', rt60: 0.55, size: 0.8 },
  { he: 'אולם', rt60: 1.6, size: 1.6 },
  { he: 'חלל גדול', rt60: 2.6, size: 2.4 },
];

const irCache = new Map<string, Float32Array>();
/** Deterministic impulse response for a room at `sr`, energy-normalised (Σh² = 1). */
export function roomIR(room: number, sr: number): Float32Array {
  const key = `${room}|${sr}`, hit = irCache.get(key);
  if (hit) return hit;
  const R = ROOMS[Math.max(0, Math.min(ROOMS.length - 1, room))];
  const len = Math.round(Math.min(3, R.rt60 * 1.1) * sr), h = new Float64Array(len);
  let s = 1234 + room * 777;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 2 ** 32) * 2 - 1; };
  for (let k = 0; k < 12; k++) {                                  // early reflections
    const t = Math.round(((R.size * (4 + 0.9 * k * k + 3 * Math.abs(rnd()))) / 1000) * sr);
    if (t < len) h[t] += (k % 2 ? -1 : 1) * 0.7 * Math.pow(0.85, k);
  }
  const lpA = Math.exp((-2 * Math.PI * 500) / sr), hpA = Math.exp((-2 * Math.PI * 4000) / sr);
  let lo = 0, hpLo = 0;
  const onset = Math.round(R.size * 0.008 * sr), build = Math.round(0.015 * sr);
  for (let i = onset; i < len; i++) {                              // diffuse tail, three bands
    const w = rnd();
    lo = lpA * lo + (1 - lpA) * w;
    hpLo = hpA * hpLo + (1 - hpA) * w;
    const high = w - hpLo, mid = hpLo - lo, t = (i - onset) / sr;
    const env = (rt: number) => Math.exp((-6.9 * t) / rt);
    const fade = Math.min(1, (i - onset) / build);
    h[i] += 0.35 * fade * (lo * env(R.rt60 * 1.1) * 1.6 + mid * env(R.rt60) + high * env(R.rt60 * 0.55));
  }
  let e = 0; for (let i = 0; i < len; i++) e += h[i] * h[i];
  const out = new Float32Array(len), g = 1 / Math.sqrt(e || 1);
  for (let i = 0; i < len; i++) out[i] = h[i] * g;
  irCache.set(key, out);
  return out;
}

/** Uniformly partitioned overlap-save convolution (1024-sample blocks); wet and dry aligned at 1024 latency. */
class RoomProc implements Processor<RoomP> {
  private sr: number; private fft = new RealFFT(N); private key = '';
  private hr: Float64Array[] = []; private hi: Float64Array[] = [];
  private fr: Float64Array[] = []; private fi: Float64Array[] = []; private t = 0;
  private prev = new Float64Array(B); private cur = new Float64Array(B); private fill = 0;
  private wet = new Float64Array(B); private frame = new Float64Array(N);
  private re = new Float64Array(BINS); private im = new Float64Array(BINS); private yr = new Float64Array(BINS); private yi = new Float64Array(BINS);
  private dry = new Float32Array(B); private mix: Smoother;
  constructor(sr: number) { this.sr = sr; this.mix = new Smoother(sr); }
  setParams(p: Partial<RoomP>) {
    const room = Math.max(0, Math.min(ROOMS.length - 1, Math.round(num(p.room, DEF.room))));
    const pre = Math.round((Math.max(0, num(p.predelay, DEF.predelay)) / 1000) * this.sr);
    this.mix.set(Math.min(1, Math.max(0, num(p.mix, DEF.mix) / 100)));
    const key = `${room}|${pre}`;
    if (key === this.key) return;
    this.key = key;
    const ir = roomIR(room, this.sr), total = pre + ir.length, P = Math.ceil(total / B);
    this.hr = []; this.hi = [];
    const seg = new Float64Array(N);
    for (let q = 0; q < P; q++) {
      seg.fill(0);
      for (let i = 0; i < B; i++) { const j = q * B + i - pre; if (j >= 0 && j < ir.length) seg[i] = ir[j]; }
      const r = new Float64Array(BINS), m = new Float64Array(BINS);
      this.fft.forward(seg, r, m); this.hr.push(r); this.hi.push(m);
    }
    if (this.fr.length !== P) {
      this.fr = Array.from({ length: P }, () => new Float64Array(BINS));
      this.fi = Array.from({ length: P }, () => new Float64Array(BINS));
      this.t = 0;
    }
  }
  private block() {
    const { frame, re, im, yr, yi, fr, fi, hr, hi } = this, P = hr.length;
    frame.set(this.prev, 0); frame.set(this.cur, B);
    this.fft.forward(frame, re, im);
    const slot = this.t % P;
    fr[slot].set(re); fi[slot].set(im);
    yr.fill(0); yi.fill(0);
    for (let q = 0; q < P; q++) {
      const s2 = (this.t - q + P * 64) % P, xr = fr[s2], xi = fi[s2], a = hr[q], b = hi[q];
      for (let k = 0; k < BINS; k++) { yr[k] += xr[k] * a[k] - xi[k] * b[k]; yi[k] += xr[k] * b[k] + xi[k] * a[k]; }
    }
    this.fft.inverse(yr, yi, frame);
    for (let i = 0; i < B; i++) this.wet[i] = frame[B + i];
    this.t++;
    const tmp = this.prev; this.prev = this.cur; this.cur = tmp;
  }
  process(x: Float32Array, y: Float32Array) {
    for (let i = 0; i < x.length; i++) {
      const v = x[i], f = this.fill;
      const d = this.dry[f], w = this.wet[f];       // both are from the previous block → aligned at latency B
      this.dry[f] = v; this.cur[f] = v;
      if (++this.fill === B) { this.fill = 0; this.block(); }
      const m = this.mix.next();
      y[i] = m === 0 ? d : d + m * (w - d);
    }
  }
  latency() { return B; }
  reset() {
    this.fr.forEach((a) => a.fill(0)); this.fi.forEach((a) => a.fill(0)); this.t = 0;
    this.prev.fill(0); this.cur.fill(0); this.wet.fill(0); this.dry.fill(0); this.fill = 0; this.mix.snap();
  }
}

export const room: ModuleDef<RoomP> = {
  id: 'room', he: 'הדהוד חדרים', en: 'Rooms (convolution)',
  blurb: 'הקול נשמע כאילו הוקלט בחדר קטן, סטודיו, אולם או חלל גדול',
  params: [
    { key: 'room', he: 'חדר', en: 'Room', min: 0, max: 3, def: 2, step: 1, unit: '', scale: 'lin' },
    { key: 'predelay', he: 'השהיה', en: 'Pre-delay', min: 0, max: 100, def: 10, step: 1, unit: 'ms', scale: 'lin' },
    { key: 'mix', he: 'מינון', en: 'Mix', min: 0, max: 100, def: 25, step: 1, unit: '%', scale: 'lin' },
  ],
  defaults: () => ({ ...DEF }),
  create: (sr) => new RoomProc(sr),
};

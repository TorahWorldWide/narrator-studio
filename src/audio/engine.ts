import type { ChainItem } from '../dsp/types';
import workletUrl from './rackProcessor.ts?worker&url';

export const SR = 48000;
const MAX_CACHE = 6;

export interface Meter { inPeak: number; outPeak: number; gr: number[] }
interface Entry { data: Float32Array; buf: AudioBuffer }

/** Real-time playback: AudioBufferSourceNode → rack worklet → destination (+ taps for the analyzer). */
class Engine {
  ctx: AudioContext | null = null;
  node: AudioWorkletNode | null = null;
  /** Taps for display: `pre` = source before the rack, `post` = worklet output. */
  pre: GainNode | null = null;
  post: GainNode | null = null;
  private cache = new Map<string, Entry>();
  private pending = new Map<string, Promise<Float32Array>>();
  private url = '';
  private src: AudioBufferSourceNode | null = null;
  private playing = false;
  private startedAt = 0;          // ctx time when the current source started
  private startPos = 0;           // buffer position (s) the current source started from
  private offset = 0;             // position while paused
  private loop: [number, number] | null = null;
  private chain: ChainItem[] = [];
  private prints: (Float32Array | null)[] = [];
  private bypass = false;
  private timeCbs = new Set<(t: number, playing: boolean) => void>();
  private meterCbs = new Set<(m: Meter) => void>();
  private raf = 0;
  private initP: Promise<void> | null = null;
  private an: { pre: AnalyserNode; post: AnalyserNode } | null = null;

  get duration() { return this.cache.get(this.url)?.buf.duration ?? 0; }
  get isPlaying() { return this.playing; }
  get currentUrl() { return this.url; }
  get loopRegion() { return this.loop; }
  data(url = this.url) { return this.cache.get(url)?.data ?? null; }

  /** Creates the AudioContext (first user gesture) and the worklet; resumes a suspended context. */
  init(): Promise<void> {
    if (!this.initP) {
      this.initP = (async () => {
        // iOS: play through the ringer/silent switch like a media app
        const nav = navigator as Navigator & { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';
        const ctx = new AudioContext({ sampleRate: SR, latencyHint: 'playback' });
        this.ctx = ctx;
        await ctx.audioWorklet.addModule(workletUrl);
        const node = new AudioWorkletNode(ctx, 'rack-processor', {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
          channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers',
        });
        node.port.onmessage = (e) => { if (e.data?.type === 'meter') this.meterCbs.forEach((cb) => cb(e.data)); };
        node.onprocessorerror = (e) => console.error('rack worklet error', e);
        this.pre = ctx.createGain(); this.post = ctx.createGain();
        this.pre.connect(node); node.connect(this.post); this.post.connect(ctx.destination);
        this.node = node;
        this.sendChain();
        node.port.postMessage({ type: 'bypass', on: this.bypass });
      })();
    }
    return this.initP.then(() => { if (this.ctx?.state === 'suspended') return this.ctx.resume(); });
  }

  /** Downloads + decodes (resampled to 48 kHz mono). Cached by url, at most 6 buffers. */
  load(url: string, onProgress?: (frac: number) => void): Promise<Float32Array> {
    const hit = this.cache.get(url);
    if (hit) { this.cache.delete(url); this.cache.set(url, hit); onProgress?.(1); return Promise.resolve(hit.data); }
    const inflight = this.pending.get(url);
    if (inflight) return inflight;
    const p = this.fetchDecode(url, onProgress).finally(() => this.pending.delete(url));
    this.pending.set(url, p);
    return p;
  }

  private async fetchDecode(url: string, onProgress?: (frac: number) => void): Promise<Float32Array> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 0;
    let bytes: Uint8Array;
    if (res.body && total) {
      const reader = res.body.getReader();
      bytes = new Uint8Array(total);
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (got + value.length > bytes.length) { const b = new Uint8Array(got + value.length); b.set(bytes); bytes = b; }
        bytes.set(value, got); got += value.length;
        onProgress?.(Math.min(0.99, got / total));
      }
      bytes = bytes.subarray(0, got);
    } else {
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    const dec = await new OfflineAudioContext(1, 1, SR).decodeAudioData(bytes.slice().buffer);
    const data = new Float32Array(dec.length);
    data.set(dec.getChannelData(0));
    if (dec.numberOfChannels > 1) { // mix down (the corpus is mono; keep this robust)
      for (let c = 1; c < dec.numberOfChannels; c++) { const ch = dec.getChannelData(c); for (let i = 0; i < data.length; i++) data[i] += ch[i]; }
      for (let i = 0; i < data.length; i++) data[i] /= dec.numberOfChannels;
    }
    const buf = new AudioBuffer({ length: data.length, sampleRate: SR, numberOfChannels: 1 });
    buf.copyToChannel(data, 0);
    this.cache.set(url, { data, buf });
    while (this.cache.size > MAX_CACHE) {
      const oldest = this.cache.keys().next().value as string;
      if (oldest === this.url) { const e = this.cache.get(oldest)!; this.cache.delete(oldest); this.cache.set(oldest, e); continue; }
      this.cache.delete(oldest);
    }
    onProgress?.(1);
    return data;
  }

  position(): number {
    if (!this.playing || !this.ctx) return this.offset;
    const raw = this.startPos + (this.ctx.currentTime - this.startedAt);
    const l = this.loop;
    if (l && this.startPos < l[1] && raw >= l[1]) return l[0] + ((raw - l[1]) % (l[1] - l[0]));
    return Math.min(raw, this.duration);
  }

  async play(fromSec?: number) {
    await this.init();
    if (!this.cache.get(this.url)) return;
    let at = fromSec ?? (this.offset >= this.duration - 0.01 ? 0 : this.offset);
    if (fromSec === undefined && this.loop && (at < this.loop[0] || at >= this.loop[1])) at = this.loop[0];
    this.startSource(at);
  }
  pause() {
    if (!this.playing) return;
    this.offset = this.position();
    this.killSource();
    this.playing = false;
    this.emitTime();
  }
  stop() {
    this.killSource();
    this.playing = false;
    this.offset = this.loop ? this.loop[0] : 0;
    this.emitTime();
  }
  seek(sec: number) {
    const t = Math.max(0, Math.min(sec, this.duration));
    if (this.playing) this.startSource(t); else { this.offset = t; this.emitTime(); }
  }
  setLoop(a?: number, b?: number) {
    this.loop = a !== undefined && b !== undefined && b - a > 0.05 ? [Math.min(a, b), Math.max(a, b)] : null;
    if (this.playing) {
      let pos = this.position();
      if (this.loop && (pos < this.loop[0] || pos >= this.loop[1])) pos = this.loop[0];
      this.startSource(pos);
    }
    this.emitTime();
  }
  setBypass(on: boolean) { this.bypass = on; this.node?.port.postMessage({ type: 'bypass', on }); }
  setChain(chain: ChainItem[], prints?: (Float32Array | null)[]) {
    this.chain = chain; if (prints) this.prints = prints; this.sendChain();
  }
  setParams(index: number, p: Record<string, unknown>) { this.node?.port.postMessage({ type: 'params', index, p }); }
  setMeasured(index: number, lufs: number) { this.node?.port.postMessage({ type: 'measured', index, lufs }); }
  setPrint(index: number, data: Float32Array) { this.prints[index] = data; this.node?.port.postMessage({ type: 'print', index, data }); }

  /** Swaps the playing buffer at the same position; keeps play state. The url must be loaded. */
  switchBuffer(url: string) {
    if (!this.cache.get(url)) return;
    const pos = this.position();
    this.url = url;
    const t = Math.min(pos, this.duration);
    if (this.playing) this.startSource(t); else { this.offset = t; this.emitTime(); }
  }

  /** Display-only analysers on the source (pre) and the rack output (post); null before init(). */
  analysers() {
    if (!this.an && this.ctx && this.pre && this.post) {
      const mk = (from: AudioNode) => {
        const a = this.ctx!.createAnalyser();
        a.fftSize = 4096; a.smoothingTimeConstant = 0.6; a.minDecibels = -100; a.maxDecibels = 0;
        from.connect(a);
        return a;
      };
      this.an = { pre: mk(this.pre), post: mk(this.post) };
    }
    return this.an;
  }

  onTime(cb: (t: number, playing: boolean) => void) { this.timeCbs.add(cb); return () => { this.timeCbs.delete(cb); }; }
  onMeter(cb: (m: Meter) => void) { this.meterCbs.add(cb); return () => { this.meterCbs.delete(cb); }; }

  private sendChain() { this.node?.port.postMessage({ type: 'chain', chain: this.chain, prints: this.prints }); }

  private startSource(at: number) {
    const ctx = this.ctx, e = this.cache.get(this.url);
    if (!ctx || !e || !this.pre) return;
    this.killSource();
    const s = ctx.createBufferSource();
    s.buffer = e.buf;
    if (this.loop) { s.loop = true; s.loopStart = this.loop[0]; s.loopEnd = this.loop[1]; }
    s.connect(this.pre);
    s.onended = () => {
      if (this.src !== s) return;
      this.src = null; this.playing = false; this.offset = this.duration; this.emitTime();
    };
    this.startPos = at;
    this.startedAt = ctx.currentTime;
    s.start(0, at);
    this.src = s;
    this.playing = true;
    this.tick();
  }
  private killSource() {
    const s = this.src;
    this.src = null;
    if (s) { s.onended = null; try { s.stop(); } catch { /* already stopped */ } s.disconnect(); }
  }
  private emitTime() { const t = this.position(); this.timeCbs.forEach((cb) => cb(t, this.playing)); }
  private tick = () => {
    cancelAnimationFrame(this.raf);
    this.emitTime();
    if (this.playing) this.raf = requestAnimationFrame(this.tick);
  };
}

export const engine = new Engine();

import { REGISTRY } from './registry';
import { hasGr, type ChainItem, type ModuleContext, type ModuleDef, type Processor } from './types';

export const BLOCK = 128;

interface Slot { id: string; on: boolean; def?: ModuleDef; proc: Processor | null }

export const mergeParams = (def: ModuleDef, p: Record<string, unknown> | undefined) => ({ ...def.defaults(), ...(p ?? {}) });

/** Ordered chain of processors. Unknown ids are kept as inert slots (pass-through). */
export class Rack {
  bypass = false;
  slots: Slot[] = [];
  private sr: number; private ctx: ModuleContext = {};
  constructor(sr = 48000) { this.sr = sr; }

  setContext(ctx: ModuleContext) { this.ctx = ctx; }

  /** Creates processors in order; reuses a processor when the id at that index is unchanged. */
  setChain(chain: ChainItem[]) {
    this.slots = chain.map((it, i) => {
      const def = REGISTRY[it.id];
      if (!def) return { id: it.id, on: false, proc: null };
      const old = this.slots[i];
      const proc = old && old.id === it.id && old.proc ? old.proc : def.create(this.sr, this.ctx);
      proc.setParams(mergeParams(def, it.p));
      return { id: it.id, on: !!it.on, def, proc };
    });
  }
  setParams(index: number, p: Record<string, unknown>) {
    const s = this.slots[index];
    if (s?.proc && s.def) s.proc.setParams(mergeParams(s.def, p));
  }
  setOn(index: number, on: boolean) { const s = this.slots[index]; if (s) s.on = on; }
  processor(index: number) { return this.slots[index]?.proc ?? null; }

  process(x: Float32Array, y: Float32Array) {
    let src = x;
    if (!this.bypass) {
      for (const s of this.slots) {
        if (!s.on || !s.proc) continue;
        s.proc.process(src, y);
        src = y;
      }
    }
    if (src !== y) y.set(src);
  }
  latency() {
    let l = 0;
    for (const s of this.slots) if (s.on && s.proc) l += s.proc.latency();
    return l;
  }
  /** Gain reduction (dB) per slot, 0 for modules that do not report it. */
  grs(): number[] { return this.slots.map((s) => (s.on && hasGr(s.proc) ? s.proc.gr : 0)); }
  reset() { this.slots.forEach((s) => s.proc?.reset()); }
}

/**
 * Render `source` through `chain` exactly like the worklet does (blocks of `block` samples, the first
 * module reads a separate input buffer), followed by latency() zeros; the output is shifted back by
 * the latency so its length and sample alignment equal the input's.
 */
export function renderOffline(
  source: Float32Array, chain: ChainItem[], sr = 48000, block = BLOCK,
  onProgress?: (frac: number) => void,
): Float32Array {
  const rack = new Rack(sr);
  rack.setContext({ source });
  rack.setChain(chain);
  const L = rack.latency();
  const total = source.length + L;
  const nBlocks = Math.ceil(total / block);
  const out = new Float32Array(nBlocks * block);
  const xb = new Float32Array(block);
  let nextTick = 0.1;
  for (let b = 0; b < nBlocks; b++) {
    const s = b * block;
    xb.fill(0);
    if (s < source.length) xb.set(source.subarray(s, Math.min(s + block, source.length)));
    rack.process(xb, out.subarray(s, s + block));
    if (onProgress && (b + 1) / nBlocks >= nextTick) { onProgress((b + 1) / nBlocks); nextTick += 0.1; }
  }
  return out.slice(L, L + source.length);
}

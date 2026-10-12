export type Scale = 'lin' | 'log';
export interface ParamDef {
  key: string; he: string; en: string;
  min: number; max: number; def: number; step: number; unit: '' | 'dB' | 'Hz' | 'ms' | 's' | '%' | 'st' | 'x';
  scale: Scale;
}
export interface Processor<P = Record<string, number | string | number[] | boolean>> {
  setParams(p: P): void;                 // may be called every frame; must not click (smooth gains ~10 ms)
  process(x: Float32Array, y: Float32Array): void; // mono, y.length === x.length, x may === y
  latency(): number;                     // samples of pure delay this module adds (0 for IIR)
  reset(): void;
}
export interface ModuleDef<P = any> {
  id: string; he: string; en: string; blurb: string;   // blurb = one Hebrew line for the "+" sheet
  params: ParamDef[];
  defaults(): P;
  create(sr: number, ctx: ModuleContext): Processor<P>;
  experimental?: boolean;                // shown with a "ניסיוני" tag (pitch, reverb)
}
export interface ModuleContext {
  // whole-file data a module may need before processing (NR noise print). Filled by the host.
  source?: Float32Array;                 // the full chapter at 48 kHz
}

/** One entry of a recipe chain (section 1 of the plan). */
export interface ChainItem { id: string; on: boolean; p: Record<string, any> }

/** Processors that report gain reduction (comp, gate, limiter, deess) expose it here, in dB ≥ 0. */
export interface HasGr { gr: number }
export const hasGr = (p: unknown): p is HasGr => typeof (p as HasGr | null)?.gr === 'number';

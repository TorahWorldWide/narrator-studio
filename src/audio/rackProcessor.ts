// AudioWorkletProcessor hosting the shared DSP Rack (mono in → rack → mono out).
import { Rack } from '../dsp/rack';
import type { ChainItem } from '../dsp/types';

declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: new () => unknown): void;
declare class AudioWorkletProcessor { readonly port: MessagePort; }

type Msg =
  | { type: 'chain'; chain: ChainItem[]; prints?: (Float32Array | null)[] }
  | { type: 'params'; index: number; p: Record<string, unknown> }
  | { type: 'bypass'; on: boolean }
  | { type: 'print'; index: number; data: Float32Array };

interface PrintTarget { setPrint(d: Float32Array): void }
const canPrint = (p: unknown): p is PrintTarget => typeof (p as PrintTarget | null)?.setPrint === 'function';

const METER_EVERY = 2048;

class RackProcessor extends AudioWorkletProcessor {
  private rack = new Rack(sampleRate);
  private zero = new Float32Array(128);
  private inPeak = 0; private outPeak = 0; private count = 0;
  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent<Msg>) => {
      const m = e.data;
      if (m.type === 'chain') {
        this.rack.setChain(m.chain);
        m.prints?.forEach((d, i) => { const p = this.rack.processor(i); if (d && canPrint(p)) p.setPrint(d); });
      } else if (m.type === 'params') this.rack.setParams(m.index, m.p);
      else if (m.type === 'bypass') this.rack.bypass = m.on;
      else if (m.type === 'print') { const p = this.rack.processor(m.index); if (canPrint(p)) p.setPrint(m.data); }
    };
  }
  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const out = outputs[0]?.[0];
    if (!out) return true;
    let x = inputs[0]?.[0];
    if (!x || x.length !== out.length) { if (this.zero.length !== out.length) this.zero = new Float32Array(out.length); x = this.zero; }
    this.rack.process(x, out);
    for (let i = 0; i < out.length; i++) {
      const a = Math.abs(x[i]), b = Math.abs(out[i]);
      if (a > this.inPeak) this.inPeak = a;
      if (b > this.outPeak) this.outPeak = b;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    this.count += out.length;
    if (this.count >= METER_EVERY) {
      this.port.postMessage({ type: 'meter', inPeak: this.inPeak, outPeak: this.outPeak, gr: this.rack.grs() });
      this.inPeak = 0; this.outPeak = 0; this.count = 0;
    }
    return true;
  }
}

registerProcessor('rack-processor', RackProcessor);

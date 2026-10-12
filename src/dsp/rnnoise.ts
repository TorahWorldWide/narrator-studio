import { RNNOISE_WASM_B64 } from './rnnoiseWasm';

/** Minimal synchronous host for the Jitsi RNNoise wasm (imports: a.a resize_heap, a.b memcpy_big). */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decodeB64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, ''), out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buf = 0, bits = 0, j = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | B64.indexOf(clean[i]); bits += 6;
    if (bits >= 8) { bits -= 8; out[j++] = (buf >> bits) & 255; }
  }
  return out;
}

let mod: WebAssembly.Module | null = null;
export const RN_FRAME = 480;

export class Rnnoise {
  private ex: Record<string, any>; private mem: WebAssembly.Memory;
  private st: number; private inPtr: number; private outPtr: number;
  constructor() {
    if (!mod) mod = new WebAssembly.Module(decodeB64(RNNOISE_WASM_B64) as BufferSource);
    let mem: WebAssembly.Memory | null = null;
    const inst = new WebAssembly.Instance(mod, {
      a: {
        a: (requested: number) => {           // emscripten_resize_heap
          const m = mem!, old = m.buffer.byteLength;
          const want = Math.max(requested >>> 0, Math.ceil(old * 1.2));
          try { m.grow(Math.ceil((want - old) / 65536)); return 1; } catch { return 0; }
        },
        b: (dest: number, src: number, num: number) => { new Uint8Array(mem!.buffer).copyWithin(dest, src, src + num); },
      },
    });
    this.ex = inst.exports as Record<string, any>;
    mem = this.mem = this.ex.c as WebAssembly.Memory;
    this.ex.d();                                // __wasm_call_ctors
    this.st = this.ex.f(0);                     // rnnoise_create(NULL)
    this.inPtr = this.ex.g(RN_FRAME * 4);       // malloc
    this.outPtr = this.ex.g(RN_FRAME * 4);
  }
  /** One 480-sample frame in −1..1 → denoised frame; returns the voice probability. */
  frame(input: Float32Array, output: Float32Array): number {
    const heap = new Float32Array(this.mem.buffer);
    const i0 = this.inPtr >> 2, o0 = this.outPtr >> 2;
    for (let i = 0; i < RN_FRAME; i++) heap[i0 + i] = input[i] * 32768;
    const vad = this.ex.j(this.st, this.outPtr, this.inPtr);
    const h2 = new Float32Array(this.mem.buffer);
    for (let i = 0; i < RN_FRAME; i++) output[i] = h2[o0 + i] / 32768;
    return vad;
  }
}

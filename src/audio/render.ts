import type { ChainItem } from '../dsp/types';

/** Renders `source` through `chain` in a Web Worker; resolves with a PCM16 48 kHz mono WAV. */
export function renderInWorker(source: Float32Array, chain: ChainItem[], onProgress?: (frac: number) => void, sr = 48000): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress?.(m.frac);
      else if (m.type === 'done') { w.terminate(); resolve(m.wav); }
      else if (m.type === 'error') { w.terminate(); reject(new Error(m.message)); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'worker error')); };
    const copy = source.slice();                     // the engine keeps its own buffer
    w.postMessage({ source: copy, chain, sr }, [copy.buffer]);
  });
}

/** Integrated LUFS of what reaches chain[index] (rendered in a worker; same code as renderOffline). */
export function measureInWorker(source: Float32Array, chain: ChainItem[], index: number, sr = 48000): Promise<number> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      if (e.data.type === 'measured') { w.terminate(); resolve(e.data.lufs); }
      else if (e.data.type === 'error') { w.terminate(); reject(new Error(e.data.message)); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'worker error')); };
    const copy = source.slice();
    w.postMessage({ type: 'measure', source: copy, chain, sr, index }, [copy.buffer]);
  });
}

export function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/// <reference lib="webworker" />
// Offline render in a Web Worker: same DSP code as the worklet and the Node CLI.
import { measureInput, renderOffline } from '../dsp/rack';
import type { ChainItem } from '../dsp/types';
import { encodeWav } from '../dsp/wav';

interface Job { type?: 'render' | 'measure'; source: Float32Array; chain: ChainItem[]; sr: number; index?: number }

self.onmessage = (e: MessageEvent<Job>) => {
  const { source, chain, sr } = e.data;
  try {
    if (e.data.type === 'measure') {
      self.postMessage({ type: 'measured', lufs: measureInput(source, chain, e.data.index ?? chain.length, sr) });
      return;
    }
    const out = renderOffline(source, chain, sr, 128, (frac) => self.postMessage({ type: 'progress', frac }));
    const wav = encodeWav(out, sr, 'pcm16');
    self.postMessage({ type: 'done', wav }, [wav]);
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err as Error)?.message ?? err) });
  }
};

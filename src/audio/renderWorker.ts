/// <reference lib="webworker" />
// Offline render in a Web Worker: same DSP code as the worklet and the Node CLI.
import { renderOffline } from '../dsp/rack';
import type { ChainItem } from '../dsp/types';
import { encodeWav } from '../dsp/wav';

interface Job { source: Float32Array; chain: ChainItem[]; sr: number }

self.onmessage = (e: MessageEvent<Job>) => {
  const { source, chain, sr } = e.data;
  try {
    const out = renderOffline(source, chain, sr, 128, (frac) => self.postMessage({ type: 'progress', frac }));
    const wav = encodeWav(out, sr, 'pcm16');
    self.postMessage({ type: 'done', wav }, [wav]);
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err as Error)?.message ?? err) });
  }
};

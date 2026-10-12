import { useEffect } from 'react';
import { engine } from './audio/engine';
import { renderInWorker } from './audio/render';
import { toPcm16 } from './dsp/wav';
import { audioUrl } from './sources';
import { getState, setState, syncPrints, useStore } from './state/store';

// Parity hooks (kept in production builds — harmless): SHA-256 of the PCM16 bytes of the current
// render / decoded source, compared by ~/pw-test/narrator_studio_parity.mjs with `npm run render`.
const sha256 = async (b: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b as BufferSource)), (x) => x.toString(16).padStart(2, '0')).join('');
Object.assign(window, {
  __source: async () => {
    const d = engine.data(getState().loadedUrl);
    return d ? { len: d.length, sha256: await sha256(new Uint8Array(toPcm16(d).buffer)) } : null;
  },
  /** Load an arbitrary URL as the current buffer (parity test feeds an ffmpeg-decoded float WAV). */
  __loadUrl: async (url: string) => {
    await engine.load(url); engine.switchBuffer(url);
    setState({ loadedUrl: url }); syncPrints();
    return engine.data(url)?.length ?? 0;
  },
  /** Max |a−b| and RMS difference (dBFS) between two loaded buffers. */
  __diff: async (a: string, b: string) => {
    const x = engine.data(a) ?? await engine.load(a), y = engine.data(b) ?? await engine.load(b);
    const n = Math.min(x.length, y.length); let mx = 0, ss = 0;
    for (let i = 0; i < n; i++) { const d = Math.abs(x[i] - y[i]); if (d > mx) mx = d; ss += d * d; }
    return { lenA: x.length, lenB: y.length, maxAbs: mx, rmsDb: 10 * Math.log10(ss / n + 1e-30), maxDb: 20 * Math.log10(mx + 1e-30) };
  },
  __render: async () => {
    const s = getState(), d = engine.data(s.loadedUrl);
    if (!d) return null;
    const wav = await renderInWorker(d, s.chain);
    return { len: (wav.byteLength - 44) / 2, sha256: await sha256(new Uint8Array(wav, 44)) };
  },
});
import AddModuleSheet from './ui/AddModuleSheet';
import Analyzer from './ui/Analyzer';
import BookChapterPicker from './ui/BookChapterPicker';
import ExportPanel from './ui/ExportPanel';
import Rack from './ui/Rack';
import SourceChips from './ui/SourceChips';
import Toast from './ui/Toast';
import TopBar from './ui/TopBar';
import Transport from './ui/Transport';
import Waveform from './ui/Waveform';

export default function App() {
  const source = useStore((s) => s.source);
  const book = useStore((s) => s.book);
  const chapter = useStore((s) => s.chapter);
  const sheet = useStore((s) => s.sheet);
  const error = useStore((s) => s.error);
  const analyzer = useStore((s) => s.analyzer);

  useEffect(() => {
    const url = audioUrl(source, book, chapter);
    let live = true;
    setState({ progress: 0, error: null });
    engine.load(url, (f) => { if (live) setState({ progress: f }); })
      .then(() => {
        if (!live) return;
        engine.switchBuffer(url);
        setState({ progress: null, loadedUrl: url });
        syncPrints();
      })
      .catch((e) => { if (live) setState({ progress: null, error: `לא הצלחתי לטעון את הקובץ (${String(e?.message ?? e)})` }); });
    return () => { live = false; };
  }, [source, book, chapter]);

  return (
    <div className="app">
      <TopBar />
      <main className="main">
        <div className="pick-row">
          <SourceChips />
          <BookChapterPicker />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <Waveform />
        {analyzer && <Analyzer />}
        <Rack />
      </main>
      <Transport />
      {sheet === 'add' && <AddModuleSheet />}
      {sheet === 'export' && <ExportPanel />}
      <Toast />
    </div>
  );
}

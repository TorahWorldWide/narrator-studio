import { useEffect } from 'react';
import { engine } from './audio/engine';
import { audioUrl } from './sources';
import { setState, useStore } from './state/store';
import AddModuleSheet from './ui/AddModuleSheet';
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

  useEffect(() => {
    const url = audioUrl(source, book, chapter);
    let live = true;
    setState({ progress: 0, error: null });
    engine.load(url, (f) => { if (live) setState({ progress: f }); })
      .then(() => {
        if (!live) return;
        engine.switchBuffer(url);
        setState({ progress: null, loadedUrl: url });
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
        <Rack />
      </main>
      <Transport />
      {sheet === 'add' && <AddModuleSheet />}
      {sheet === 'export' && <ExportPanel />}
      <Toast />
    </div>
  );
}

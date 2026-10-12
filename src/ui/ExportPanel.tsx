import { useMemo, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { download, renderInWorker } from '../audio/render';
import { serialize } from '../recipe';
import { setState, toast, useStore } from '../state/store';

const APP_URL = 'https://torahworldwide.github.io/narrator-studio/';

export default function ExportPanel() {
  const source = useStore((s) => s.source);
  const book = useStore((s) => s.book);
  const chapter = useStore((s) => s.chapter);
  const note = useStore((s) => s.note);
  const chain = useStore((s) => s.chain);
  const json = useMemo(() => serialize({ source, book, chapter, note, chain }), [source, book, chapter, note, chain]);
  const preRef = useRef<HTMLPreElement>(null);
  const loadedUrl = useStore((s) => s.loadedUrl);
  const [render, setRender] = useState<{ frac: number } | null>(null);
  const [rendered, setRendered] = useState(false);
  const close = () => setState({ sheet: null });
  const base = `${book}_${chapter}.${source}`;
  const saveRecipe = () => download(json, `${base}.recipe.json`, 'application/json');

  const renderWav = async () => {
    const data = engine.data(loadedUrl);
    if (!data || render) return;
    setRender({ frac: 0 }); setRendered(false);
    try {
      const wav = await renderInWorker(data, chain, (frac) => setRender({ frac }));
      download(wav, `${base}.wav`, 'audio/wav');
      setTimeout(saveRecipe, 400);
      setRendered(true);
      toast('הקובץ ירד');
    } catch (e) {
      toast(`העיבוד נכשל: ${String((e as Error)?.message ?? e)}`);
    } finally { setRender(null); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(json); toast('הועתק'); return; } catch { /* fall back below */ }
    const sel = window.getSelection(), pre = preRef.current;
    if (sel && pre) {
      const r = document.createRange(); r.selectNodeContents(pre); sel.removeAllRanges(); sel.addRange(r);
      const ok = document.execCommand('copy'); sel.removeAllRanges();
      toast(ok ? 'הועתק' : 'לא הצלחתי להעתיק — סמן את הטקסט והעתק ידנית');
    }
  };
  const telegram = () => {
    const u = `https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(json)}`;
    window.open(u, '_blank', 'noopener');
  };

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" role="dialog" aria-label="ייצוא" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-h">
          <h2>ייצוא מתכון</h2>
          <button type="button" className="icon" aria-label="סגור" onClick={close}>✕</button>
        </div>
        <div className="export-btns">
          <button type="button" className="btn primary" onClick={copy}>העתק מתכון</button>
          <button type="button" className="btn" onClick={telegram}>שלח בטלגרם</button>
        </div>
        <div className="export-btns">
          <button type="button" className="btn" disabled={!loadedUrl || !!render} onClick={renderWav}>
            {render ? `מעבד… ${Math.round(render.frac * 100)}%` : 'הורד WAV'}
          </button>
          {rendered && <button type="button" className="btn" onClick={saveRecipe}>הורד מתכון</button>}
        </div>
        {render && <div className="render-bar"><div style={{ width: `${render.frac * 100}%` }} /></div>}
        <label className="note">
          <span>הערה</span>
          <textarea rows={2} value={note} onChange={(e) => setState({ note: e.target.value })} placeholder="מה ניסית, מה שמעת…" />
        </label>
        <pre className="json" dir="ltr" ref={preRef}>{json}</pre>
      </div>
    </div>
  );
}

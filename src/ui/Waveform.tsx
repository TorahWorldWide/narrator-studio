import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine, SR } from '../audio/engine';
import { setLoop, setState, useStore } from '../state/store';
import { fmtTime } from './format';

const H = 120, BINS = 16384, MAXZ = 8;

function computePeaks(d: Float32Array) {
  const mn = new Float32Array(BINS), mx = new Float32Array(BINS), per = d.length / BINS;
  for (let b = 0; b < BINS; b++) {
    const from = Math.floor(b * per), to = Math.max(from + 1, Math.floor((b + 1) * per));
    let lo = 0, hi = 0;
    for (let i = from; i < to && i < d.length; i++) { const v = d[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    mn[b] = lo; mx[b] = hi;
  }
  return { mn, mx };
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';

export default function Waveform() {
  const url = useStore((s) => s.loadedUrl);
  const loop = useStore((s) => s.loop);
  const zoom = useStore((s) => s.zoom);
  const data = url ? engine.data(url) : null;
  const peaks = useMemo(() => (data ? computePeaks(data) : null), [data]);
  const dur = data ? data.length / SR : 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const [w, setW] = useState(0);
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const gesture = useRef<{ x: number; t0: number; mode: 'pending' | 'loop' | 'edge'; edge?: 0 | 1 } | null>(null);
  const shown = draft ?? loop;
  const cw = Math.max(1, Math.round(w * zoom));
  const live = useRef({ cw, dur, shown, t: 0 });
  live.current = { ...live.current, cw, dur, shown };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { cw: W0, dur: D, shown: L, t } = live.current;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(W0 * dpr), HH = Math.round(H * dpr);
    if (c.width !== W || c.height !== HH) { c.width = W; c.height = HH; }
    const g = c.getContext('2d');
    if (!g) return;
    g.fillStyle = css('--panel'); g.fillRect(0, 0, W, HH);
    if (waveRef.current && waveRef.current.width === W) g.drawImage(waveRef.current, 0, 0);
    if (!D) return;
    const accent = css('--accent');
    if (L) {
      const a = (L[0] / D) * W, b = (L[1] / D) * W;
      g.globalAlpha = 0.18; g.fillStyle = accent; g.fillRect(a, 0, b - a, HH);
      g.globalAlpha = 1; g.fillRect(a - dpr, 0, 2 * dpr, HH); g.fillRect(b - dpr, 0, 2 * dpr, HH);
    }
    const x = (t / D) * W;
    g.fillStyle = accent; g.fillRect(x - dpr, 0, 2 * dpr, HH);
  }, []);

  // static waveform image, rebuilt per buffer / width / zoom
  useEffect(() => {
    if (!peaks || cw <= 1) { waveRef.current = null; draw(); return; }
    const dpr = window.devicePixelRatio || 1;
    const off = document.createElement('canvas');
    off.width = Math.round(cw * dpr); off.height = Math.round(H * dpr);
    const g = off.getContext('2d')!;
    const W = off.width, mid = off.height / 2;
    g.fillStyle = css('--wave');
    for (let px = 0; px < W; px++) {
      const b0 = Math.floor((px * BINS) / W), b1 = Math.max(b0 + 1, Math.floor(((px + 1) * BINS) / W));
      let lo = 0, hi = 0;
      for (let b = b0; b < b1 && b < BINS; b++) { if (peaks.mn[b] < lo) lo = peaks.mn[b]; if (peaks.mx[b] > hi) hi = peaks.mx[b]; }
      const y0 = mid - hi * mid * 0.95, y1 = mid - lo * mid * 0.95;
      g.fillRect(px, y0, 1, Math.max(1, y1 - y0));
    }
    waveRef.current = off;
    draw();
  }, [peaks, cw, draw]);

  useEffect(() => { draw(); }, [shown, draw]);

  useEffect(() => engine.onTime((t, playing) => {
    live.current.t = t;
    draw();
    const el = scrollRef.current, D = live.current.dur;
    if (playing && el && D && live.current.cw > el.clientWidth) {
      const x = (t / D) * live.current.cw;
      if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 8) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.1);
    }
  }), [draw]);

  const tAt = (clientX: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return Math.min(dur, Math.max(0, ((clientX - r.left) / r.width) * dur));
  };
  const onDown = (e: React.PointerEvent, edge?: 0 | 1) => {
    if (!dur) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    gesture.current = edge === undefined ? { x: e.clientX, t0: tAt(e.clientX), mode: 'pending' } : { x: e.clientX, t0: 0, mode: 'edge', edge };
  };
  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const t = tAt(e.clientX);
    if (g.mode === 'pending' && Math.abs(e.clientX - g.x) > 8) g.mode = 'loop';
    if (g.mode === 'loop') setDraft([Math.min(g.t0, t), Math.max(g.t0, t)]);
    if (g.mode === 'edge' && loop) {
      const base = draft ?? loop;
      const next: [number, number] = g.edge === 0 ? [t, base[1]] : [base[0], t];
      setDraft(next);
    }
  };
  const onUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode === 'pending') { engine.seek(g.t0); return; }
    const d = draft;
    setDraft(null);
    if (d) {
      const a = Math.min(d[0], d[1]), b = Math.max(d[0], d[1]);
      if (b - a > 0.05) setLoop([a, b]);
    }
  };

  const zoomBy = (f: number) => {
    const el = scrollRef.current;
    const z = Math.min(MAXZ, Math.max(1, zoom * f));
    if (z === zoom) return;
    const centre = el ? (el.scrollLeft + el.clientWidth / 2) / cw : 0;
    setState({ zoom: z });
    requestAnimationFrame(() => { if (el) el.scrollLeft = Math.max(0, centre * w * z - el.clientWidth / 2); });
  };

  return (
    <div className="wave">
      <div className="wave-scroll" ref={scrollRef} dir="ltr">
        <div className="wave-content" style={{ width: cw }}>
          <canvas ref={canvasRef} className="wave-canvas" style={{ width: cw, height: H }} aria-label="צורת גל — הקשה קופצת, גרירה יוצרת לופ"
            onPointerDown={(e) => onDown(e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          {shown && dur > 0 && ([0, 1] as const).map((edge) => (
            <div key={edge} className="loop-handle" style={{ left: (shown[edge] / dur) * cw - 22 }}
              aria-label={edge === 0 ? 'תחילת לופ' : 'סוף לופ'}
              onPointerDown={(e) => onDown(e, edge)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          ))}
          {zoom > 1 && <div className="wave-strip">⟵ גרור כאן לגלילה ⟶</div>}
        </div>
      </div>
      <div className="wave-tools">
        <button type="button" className="icon" aria-label="הקטן" disabled={zoom <= 1} onClick={() => zoomBy(0.5)}>−</button>
        <span className="muted zoom-val">{zoom}×</span>
        <button type="button" className="icon" aria-label="הגדל" disabled={zoom >= MAXZ} onClick={() => zoomBy(2)}>+</button>
        <span className="spacer" />
        {loop && <span className="muted loop-val">לופ {fmtTime(loop[0])}–{fmtTime(loop[1])}</span>}
        <button type="button" className="btn small" disabled={!loop} onClick={() => setLoop(null)}>× לופ</button>
      </div>
    </div>
  );
}

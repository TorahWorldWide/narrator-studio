import { useEffect, useRef, useState } from 'react';
import { engine, SR } from '../audio/engine';

const H = 160, FMIN = 20, FMAX = 20000, GRID = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
const xOf = (f: number, W: number) => (Math.log10(f / FMIN) / Math.log10(FMAX / FMIN)) * W;
const yOf = (db: number, HH: number) => (Math.min(0, Math.max(-100, db)) / -100) * HH;

/** Spectrum of the rack output (accent) over the pre-rack source (faint). Display only. */
export default function Analyzer() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [frozen, setFrozen] = useState(false);
  const frozenRef = useRef(false);
  frozenRef.current = frozen;

  useEffect(() => {
    let raf = 0;
    const pre = new Float32Array(2048), post = new Float32Array(2048);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1, W = Math.round(c.clientWidth * dpr), HH = Math.round(H * dpr);
      if (c.width !== W || c.height !== HH) { c.width = W; c.height = HH; }
      const an = engine.analysers();
      if (an && !frozenRef.current) { an.pre.getFloatFrequencyData(pre); an.post.getFloatFrequencyData(post); }
      if (frozenRef.current && c.dataset.drawn === '1') return;
      const g = c.getContext('2d');
      if (!g) return;
      g.fillStyle = css('--panel'); g.fillRect(0, 0, W, HH);
      g.strokeStyle = css('--line'); g.lineWidth = dpr; g.fillStyle = css('--muted'); g.font = `${10 * dpr}px system-ui, sans-serif`;
      for (const f of GRID) {
        const x = Math.round(xOf(f, W)) + 0.5;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, HH); g.stroke();
        g.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x + 2 * dpr, HH - 3 * dpr);
      }
      for (let db = -20; db > -100; db -= 20) {
        const y = Math.round(yOf(db, HH)) + 0.5;
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
        g.fillText(String(db), 2 * dpr, y - 2 * dpr);
      }
      if (!an) return;
      const binHz = SR / 4096;
      const trace = (data: Float32Array, color: string, alpha: number) => {
        g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = 1.5 * dpr; g.beginPath();
        for (let x = 0; x < W; x++) {
          const f = FMIN * Math.pow(FMAX / FMIN, x / W), b = f / binHz, i = Math.floor(b), t = b - i;
          const v = i + 1 < data.length ? data[i] * (1 - t) + data[i + 1] * t : data[data.length - 1];
          const y = yOf(Number.isFinite(v) ? v : -100, HH);
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke(); g.globalAlpha = 1;
      };
      trace(pre, css('--muted'), 0.45);
      trace(post, css('--accent'), 1);
      c.dataset.drawn = '1';
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="analyzer">
      <div className="analyzer-box" dir="ltr">
        <canvas ref={ref} className="analyzer-canvas" style={{ height: H }} aria-label="אנלייזר תדרים" />
      </div>
      <div className="wave-tools">
        <span className="muted legend"><span className="sw post" /> אחרי <span className="sw pre" /> לפני</span>
        <span className="spacer" />
        <button type="button" className={`btn small${frozen ? ' sel-on' : ''}`} aria-pressed={frozen}
          onClick={() => { if (ref.current) ref.current.dataset.drawn = '0'; setFrozen(!frozen); }}>{frozen ? 'הפשר' : 'הקפא'}</button>
      </div>
    </div>
  );
}

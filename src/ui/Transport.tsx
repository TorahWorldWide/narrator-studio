import { useEffect, useState } from 'react';
import { engine } from '../audio/engine';
import { setBypass, toast, useStore } from '../state/store';
import { fmtDb, fmtTime } from './format';
import { useMeter } from './useMeter';

function PeakBar({ label, lin }: { label: string; lin: number }) {
  const db = lin > 1e-5 ? 20 * Math.log10(lin) : -60;
  const w = Math.min(100, Math.max(0, ((db + 60) / 60) * 100));
  return (
    <div className="pk">
      <span className="pk-l">{label}</span>
      <div className="pk-track"><div className={`pk-fill${db > -1 ? ' hot' : ''}`} style={{ width: `${w}%` }} /></div>
      <span className="pk-v">{fmtDb(lin)}</span>
    </div>
  );
}

export default function Transport() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const url = useStore((s) => s.loadedUrl);
  const bypass = useStore((s) => s.bypass);
  const m = useMeter();
  useEffect(() => engine.onTime((tt, p) => { setT(tt); setPlaying(p); }), []);
  const dur = url ? engine.duration : 0;
  const play = () => {
    if (playing) engine.pause();
    else engine.play().catch((e) => toast(`לא הצלחתי לנגן: ${String(e?.message ?? e)}`));
  };
  return (
    <footer className="transport">
      <div className="tp-row">
        <button type="button" className="tp-btn play" aria-label={playing ? 'השהה' : 'נגן'} disabled={!url} onClick={play}>{playing ? '❚❚' : '▶'}</button>
        <button type="button" className="tp-btn" aria-label="עצור" disabled={!url} onClick={() => engine.stop()}>■</button>
        <span className="tp-time" dir="ltr">{fmtTime(t)} / {fmtTime(dur)}</span>
        <button type="button" className={`ab${bypass ? ' b' : ''}`} aria-pressed={bypass} onClick={() => setBypass(!bypass)}>
          {bypass ? 'בלי אפקטים' : 'עם אפקטים'}
        </button>
      </div>
      <div className="tp-meters">
        <PeakBar label="כניסה" lin={m.inPeak} />
        <PeakBar label="יציאה" lin={m.outPeak} />
      </div>
    </footer>
  );
}

import { REGISTRY } from '../dsp/registry';
import type { ChainItem } from '../dsp/types';
import { HUM_WARNING } from '../dsp/modules/hum';
import { isRegion } from '../dsp/modules/nr';
import { moveModule, removeModule, resetModule, setNrPrint, setParam, toggleModule, useStore } from '../state/store';
import { fmtTime } from './format';
import Knob from './Knob';
import { useMeter } from './useMeter';

const EQ_TYPES = ['פעמון', 'מדף נמוך', 'מדף גבוה'];
const GR_MODULES = new Set(['comp', 'gate']);

function GrBar({ index }: { index: number }) {
  const gr = useMeter().gr[index] ?? 0;
  const w = Math.min(100, (gr / 24) * 100);
  return (
    <div className="gr" aria-label="הנחתה">
      <span className="gr-label">הנחתה</span>
      <div className="gr-track"><div className="gr-fill" style={{ width: `${w}%` }} /></div>
      <span className="gr-val">{gr > 0.05 ? `−${gr.toFixed(1)}` : '0.0'} dB</span>
    </div>
  );
}

function NrControls({ item, index }: { item: ChainItem; index: number }) {
  const loop = useStore((s) => s.loop);
  const region = isRegion(item.p.print) ? item.p.print : null;
  const smooth = item.p.smooth !== false;
  return (
    <div className="nr-row">
      <div className="nr-active">
        <span className="muted">פרופיל רעש:</span>{' '}
        {region ? <b>מהלופ {fmtTime(region[0])}–{fmtTime(region[1])}</b> : <b>אוטומטי (15% השקטים בפרק)</b>}
      </div>
      <div className="nr-btns">
        <button type="button" className={`btn small${region ? ' sel-on' : ''}`} disabled={!loop} onClick={() => loop && setNrPrint(index, [loop[0], loop[1]])}>למד רעש מהלופ</button>
        <button type="button" className={`btn small${region ? '' : ' sel-on'}`} disabled={!region} onClick={() => setNrPrint(index, 'auto')}>אוטומטי</button>
        <button type="button" className={`btn small${smooth ? ' sel-on' : ''}`} aria-pressed={smooth} onClick={() => setParam(index, 'smooth', !smooth)}>החלקה {smooth ? 'פועלת' : 'כבויה'}</button>
      </div>
    </div>
  );
}

export default function ModuleCard({ item, index, count }: { item: ChainItem; index: number; count: number }) {
  const def = REGISTRY[item.id];
  if (!def) return null;
  return (
    <section className={`card${item.on ? '' : ' off'}`} data-id={item.id}>
      <header className="card-h">
        <button type="button" className={`power${item.on ? ' on' : ''}`} aria-pressed={item.on}
          aria-label={item.on ? 'כבה' : 'הפעל'} onClick={() => toggleModule(index)}>⏻</button>
        <div className="card-name">
          {def.he} <span className="muted">· {def.en}</span>
          {def.experimental && <span className="tag">ניסיוני</span>}
        </div>
        <div className="card-tools">
          <button type="button" className="icon" aria-label="הזז למעלה" disabled={index === 0} onClick={() => moveModule(index, -1)}>↑</button>
          <button type="button" className="icon" aria-label="הזז למטה" disabled={index === count - 1} onClick={() => moveModule(index, 1)}>↓</button>
          <button type="button" className="icon" aria-label="איפוס" onClick={() => resetModule(index)}>↺</button>
          <button type="button" className="icon" aria-label="הסר" onClick={() => removeModule(index)}>✕</button>
        </div>
      </header>
      {GR_MODULES.has(item.id) && <GrBar index={index} />}
      {item.id === 'nr' && <NrControls item={item} index={index} />}
      {item.id === 'hum' && <p className="card-note">{HUM_WARNING}</p>}
      <div className="knobs">
        {def.params.map((pd) => (
          <Knob key={pd.key} def={pd} value={typeof item.p[pd.key] === 'number' ? item.p[pd.key] : pd.def}
            onChange={(v) => setParam(index, pd.key, v)}
            format={item.id === 'eq' && pd.key.endsWith('type') ? (v) => EQ_TYPES[Math.round(v)] ?? String(v) : undefined} />
        ))}
      </div>
    </section>
  );
}

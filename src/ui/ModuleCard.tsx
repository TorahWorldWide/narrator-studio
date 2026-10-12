import { REGISTRY } from '../dsp/registry';
import type { ChainItem } from '../dsp/types';
import { moveModule, removeModule, resetModule, setParam, toggleModule } from '../state/store';
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

import { groupOf } from '../dsp/groups';
import { REGISTRY } from '../dsp/registry';
import type { ChainItem } from '../dsp/types';
import { HUM_WARNING } from '../dsp/modules/hum';
import { isRegion } from '../dsp/modules/nr';
import { GEQ_BANDS, geqKey } from '../dsp/modules/geq';
import { LOFI_TYPES } from '../dsp/modules/lofi';
import { PHASER_TYPES } from '../dsp/modules/phaser';
import { PITCH_WARNING } from '../dsp/modules/pitch';
import { ROOMS } from '../dsp/modules/room';
import { moveModule, removeModule, resetModule, setNrPrint, setParam, toggleModule, useStore } from '../state/store';
import { fmtTime } from './format';
import Knob from './Knob';
import { useMeter } from './useMeter';

const EQ_TYPES = ['פעמון', 'מדף נמוך', 'מדף גבוה'];
/** Names for the discrete "type" knobs: `${module}.${param}` (eq: any b*type). */
const TYPE_NAMES: Record<string, string[]> = {
  'phaser.type': PHASER_TYPES, 'lofi.type': LOFI_TYPES, 'room.room': ROOMS.map((r) => r.he),
};
const typeNames = (id: string, key: string) => (id === 'eq' && key.endsWith('type') ? EQ_TYPES : TYPE_NAMES[`${id}.${key}`]);
const GR_MODULES = new Set(['comp', 'gate', 'expander', 'mbcomp', 'dyneq', 'deess', 'deplosive']);

/** Graphic EQ: one horizontal slider per band (touch-friendly rows). */
function GeqSliders({ item, index }: { item: ChainItem; index: number }) {
  return (
    <div className="geq">
      {GEQ_BANDS.map((f) => {
        const k = geqKey(f), v = typeof item.p[k] === 'number' ? item.p[k] : 0;
        const label = f >= 1000 ? `${f / 1000}k` : String(f);
        return (
          <label key={k} className="geq-row">
            <span className="geq-f">{label}</span>
            <input type="range" min={-12} max={12} step={0.5} value={v} aria-label={`${label} הרץ`}
              onChange={(e) => setParam(index, k, Number(e.target.value))}
              onDoubleClick={() => setParam(index, k, 0)} />
            <span className="geq-v">{v > 0 ? '+' : ''}{v.toFixed(1)}</span>
          </label>
        );
      })}
    </div>
  );
}

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

function LoudnessInfo({ item, index }: { item: ChainItem; index: number }) {
  const m = useStore((s) => s.measures[index]);
  if (!item.on) return null;
  if (m === undefined || m === 'busy') return <p className="card-info">מודד את העוצמה של הפרק…</p>;
  const target = typeof item.p.target === 'number' ? item.p.target : -19;
  const g = Math.max(-24, Math.min(24, target - m));
  return <p className="card-info">נמדד {m.toFixed(1)} LUFS ← {g >= 0 ? '+' : ''}{g.toFixed(1)} dB</p>;
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
          <span className="card-group" title={groupOf(item.id)?.he} aria-hidden="true">{groupOf(item.id)?.icon}</span>{def.he} <span className="muted">· {def.en}</span>
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
      {item.id === 'pitch' && <p className="card-note">{PITCH_WARNING}</p>}
      {item.id === 'loudness' && <LoudnessInfo item={item} index={index} />}
      {item.id === 'debreath' && <p className="card-note">תקשיב שלא נבלעים ה׳ ו-ח׳ — אם כן, הגדל את "אורך מינימום"</p>}
      {item.id === 'geq' ? <GeqSliders item={item} index={index} /> : (
        <div className="knobs">
          {def.params.map((pd) => {
            const names = typeNames(item.id, pd.key);
            return (
              <Knob key={pd.key} def={pd} value={typeof item.p[pd.key] === 'number' ? item.p[pd.key] : pd.def}
                onChange={(v) => setParam(index, pd.key, v)}
                format={names ? (v) => names[Math.round(v)] ?? String(v) : undefined} />
            );
          })}
        </div>
      )}
    </section>
  );
}

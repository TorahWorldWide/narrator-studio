import { deletePreset, loadPreset, savePreset, useStore } from '../state/store';

export default function Presets() {
  const presets = useStore((s) => s.presets);
  const save = () => {
    const name = prompt('שם לפריסט');
    if (name) savePreset(name);
  };
  return (
    <section className="presets" aria-label="פריסטים">
      <h2>פריסטים</h2>
      <button type="button" className="btn" onClick={save}>שמור כפריסט</button>
      <ul className="preset-list">
        {presets.map((p) => (
          <li key={p.name} className="preset">
            <span className="preset-name">{p.name}</span>
            <button type="button" className="btn small" onClick={() => loadPreset(p)}>טען</button>
            <button type="button" className="btn small" onClick={() => { if (confirm(`למחוק את "${p.name}"?`)) deletePreset(p.name); }}>מחק</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

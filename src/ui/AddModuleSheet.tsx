import { MODULES } from '../dsp/registry';
import { addModule, setState } from '../state/store';

export default function AddModuleSheet() {
  const close = () => setState({ sheet: null });
  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" role="dialog" aria-label="הוסף אפקט" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-h">
          <h2>הוסף אפקט</h2>
          <button type="button" className="icon" aria-label="סגור" onClick={close}>✕</button>
        </div>
        <ul className="add-list">
          {MODULES.map((m) => (
            <li key={m.id}>
              <button type="button" className="add-item" onClick={() => { addModule(m.id); close(); }}>
                <span className="add-name">{m.he} · {m.en}{m.experimental && <span className="tag">ניסיוני</span>}</span>
                <span className="add-blurb">{m.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

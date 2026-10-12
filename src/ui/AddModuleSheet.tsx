import { useMemo, useState } from 'react';
import { GROUPS } from '../dsp/groups';
import { REGISTRY } from '../dsp/registry';
import { addModule, setState } from '../state/store';

/** Effects grouped (chips filter one group, search filters by Hebrew/English name or description). */
export default function AddModuleSheet() {
  const [group, setGroup] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const close = () => setState({ sheet: null });
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GROUPS.filter((g) => !group || g.id === group).map((g) => ({
      ...g,
      defs: g.modules.map((id) => REGISTRY[id]).filter(Boolean).filter((m) =>
        !needle || `${m.he} ${m.en} ${m.blurb}`.toLowerCase().includes(needle)),
    })).filter((g) => g.defs.length);
  }, [group, q]);
  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet add-sheet" role="dialog" aria-label="הוסף אפקט" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-h">
          <h2>הוסף אפקט</h2>
          <button type="button" className="icon" aria-label="סגור" onClick={close}>✕</button>
        </div>
        <input className="search" type="search" placeholder="חיפוש…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש אפקט" />
        <div className="group-chips" role="tablist" aria-label="קבוצות">
          <button type="button" role="tab" aria-selected={!group} className={`gchip${!group ? ' on' : ''}`} onClick={() => setGroup(null)}>הכל</button>
          {GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={group === g.id} className={`gchip${group === g.id ? ' on' : ''}`}
              onClick={() => setGroup(group === g.id ? null : g.id)}>{g.icon} {g.he}</button>
          ))}
        </div>
        {groups.map((g) => (
          <section key={g.id} className="add-group" aria-label={g.he}>
            <h3 className="add-group-h">{g.icon} {g.he}</h3>
            <ul className="add-list">
              {g.defs.map((m) => (
                <li key={m.id}>
                  <button type="button" className="add-item" onClick={() => { addModule(m.id); close(); }}>
                    <span className="add-name">{m.he} · {m.en}{m.experimental && <span className="tag">ניסיוני</span>}</span>
                    <span className="add-blurb">{m.blurb}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length && <p className="muted">לא נמצא אפקט.</p>}
      </div>
    </div>
  );
}

import { setState, useStore } from '../state/store';
import ModuleCard from './ModuleCard';

export default function Rack() {
  const chain = useStore((s) => s.chain);
  return (
    <div className="rack">
      {chain.length === 0 && <p className="muted empty">אין אפקטים עדיין — הוסף אחד או טען פריסט.</p>}
      {chain.map((it, i) => <ModuleCard key={`${i}-${it.id}`} item={it} index={i} count={chain.length} />)}
      <button type="button" className="btn add-btn" onClick={() => setState({ sheet: 'add' })}>+ הוסף אפקט</button>
    </div>
  );
}

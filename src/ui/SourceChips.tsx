import { SOURCE_IDS, SOURCES, hasSource } from '../sources';
import { selectSource, useStore } from '../state/store';

export default function SourceChips() {
  const source = useStore((s) => s.source);
  const book = useStore((s) => s.book);
  return (
    <div className="chips" role="radiogroup" aria-label="קריין">
      {SOURCE_IDS.map((id) => {
        const ok = hasSource(id, book);
        return (
          <button key={id} type="button" role="radio" aria-checked={source === id}
            className={`chip${source === id ? ' on' : ''}`} disabled={!ok} title={ok ? undefined : 'אין עדיין לספר הזה'}
            onClick={() => selectSource(id)}>{SOURCES[id].he}</button>
        );
      })}
    </div>
  );
}

import { BOOKS, SECTIONS, bookByEnglish } from '../sources';
import { selectChapter, useStore } from '../state/store';

export default function BookChapterPicker() {
  const book = useStore((s) => s.book);
  const chapter = useStore((s) => s.chapter);
  const b = bookByEnglish(book) ?? BOOKS[0];
  const bi = BOOKS.indexOf(b);
  const step = (d: -1 | 1) => {
    const c = chapter + d;
    if (c >= 1 && c <= b.chapters) return selectChapter(b.english, c);
    const nb = BOOKS[bi + d];
    if (nb) selectChapter(nb.english, d > 0 ? 1 : nb.chapters);
  };
  return (
    <div className="picker">
      <select className="sel book" aria-label="ספר" value={b.english} onChange={(e) => selectChapter(e.target.value, 1)}>
        {SECTIONS.map((sec) => (
          <optgroup key={sec} label={sec}>
            {BOOKS.filter((x) => x.section === sec).map((x) => <option key={x.english} value={x.english}>{x.hebrew}</option>)}
          </optgroup>
        ))}
      </select>
      <button type="button" className="icon" aria-label="פרק קודם" disabled={bi === 0 && chapter === 1} onClick={() => step(-1)}>›</button>
      <select className="sel chap" aria-label="פרק" value={chapter} onChange={(e) => selectChapter(b.english, Number(e.target.value))}>
        {Array.from({ length: b.chapters }, (_, i) => <option key={i + 1} value={i + 1}>פרק {i + 1}</option>)}
      </select>
      <button type="button" className="icon" aria-label="פרק הבא" disabled={bi === BOOKS.length - 1 && chapter === b.chapters} onClick={() => step(1)}>‹</button>
    </div>
  );
}

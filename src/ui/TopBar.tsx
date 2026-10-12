import { setState, useStore } from '../state/store';

export default function TopBar() {
  const progress = useStore((s) => s.progress);
  const analyzer = useStore((s) => s.analyzer);
  return (
    <>
      <header className="topbar">
        <h1 className="title">סטודיו קריין</h1>
        <span className="spacer" />
        <button type="button" className={`btn${analyzer ? ' sel-on' : ''}`} aria-pressed={analyzer} onClick={() => setState({ analyzer: !analyzer })}>📈 אנלייזר</button>
        <button type="button" className="btn" onClick={() => setState({ sheet: 'export' })}>⤓ ייצוא</button>
      </header>
      <div className="progress" role="progressbar" aria-label="הורדה" aria-valuenow={progress === null ? 100 : Math.round(progress * 100)}
        data-loading={progress !== null ? '1' : '0'}>
        <div className="progress-fill" style={{ width: `${(progress ?? 0) * 100}%`, opacity: progress === null ? 0 : 1 }} />
      </div>
    </>
  );
}

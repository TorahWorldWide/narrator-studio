import { useEffect } from 'react';
import { setState, useStore } from '../state/store';

export default function Toast() {
  const t = useStore((s) => s.toast);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setState((s) => (s.toast?.id === t.id ? { toast: null } : {})), 2200);
    return () => clearTimeout(h);
  }, [t]);
  return t ? <div className="toast" role="status">{t.msg}</div> : null;
}

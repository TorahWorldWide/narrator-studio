import { useSyncExternalStore } from 'react';
import { engine } from '../audio/engine';
import { REGISTRY } from '../dsp/registry';
import type { ChainItem } from '../dsp/types';
import { BOOKS, hasSource, type SourceId } from '../sources';

export interface Preset { name: string; chain: ChainItem[] }
export type Sheet = null | 'add' | 'export';

export interface State {
  source: SourceId; book: string; chapter: number;
  chain: ChainItem[];
  presets: Preset[];
  note: string;
  bypass: boolean;
  loop: [number, number] | null;
  zoom: number;
  progress: number | null;      // download progress 0..1 while loading
  error: string | null;
  loadedUrl: string;
  sheet: Sheet;
  toast: { msg: string; id: number } | null;
}

const KEY = 'narrator-studio:v1';
const PERSIST = ['chain', 'source', 'book', 'chapter', 'presets'] as const;

const DEFAULTS: State = {
  source: 'live', book: 'Genesis', chapter: 1, chain: [], presets: [], note: '', bypass: false,
  loop: null, zoom: 1, progress: null, error: null, loadedUrl: '', sheet: null, toast: null,
};

function readPersisted(): Partial<State> & { _fresh?: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { _fresh: true };
    const o = JSON.parse(raw);
    const out: Partial<State> = {};
    if (Array.isArray(o.chain)) out.chain = o.chain;
    if (Array.isArray(o.presets)) out.presets = o.presets;
    const b = BOOKS.find((x) => x.english === o.book);
    if (b) { out.book = b.english; if (Number.isInteger(o.chapter) && o.chapter >= 1 && o.chapter <= b.chapters) out.chapter = o.chapter; }
    if (o.source === 'orig' || o.source === 'live' || o.source === 'b43') out.source = o.source;
    if (out.source && !hasSource(out.source, out.book ?? DEFAULTS.book)) out.source = 'live';
    return out;
  } catch { return { _fresh: true }; }
}

const persisted = typeof localStorage === 'undefined' ? { _fresh: true } : readPersisted();
export const firstRun = !!persisted._fresh;
delete persisted._fresh;
let state: State = { ...DEFAULTS, ...persisted };
const subs = new Set<() => void>();

function persist(prev: State) {
  if (PERSIST.every((k) => prev[k] === state[k])) return;
  try {
    const o: Record<string, unknown> = {};
    PERSIST.forEach((k) => { o[k] = state[k]; });
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch { /* storage full or blocked: keep working in memory */ }
}

export const getState = () => state;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const prev = state;
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  persist(prev);
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** Selector must return a primitive or a reference already held by the state. */
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

// ---------- actions ----------
let toastId = 0;
export function toast(msg: string) { setState({ toast: { msg, id: ++toastId } }); }

function setChain(chain: ChainItem[]) { setState({ chain }); engine.setChain(chain); }

export function addModule(id: string) {
  const def = REGISTRY[id];
  if (!def) { toast('האפקט הזה יגיע בשלב הבא'); return; }
  setChain([...state.chain, { id, on: true, p: def.defaults() }]);
}
export function removeModule(i: number) { setChain(state.chain.filter((_, k) => k !== i)); }
export function moveModule(i: number, d: -1 | 1) {
  const j = i + d;
  if (j < 0 || j >= state.chain.length) return;
  const c = state.chain.slice();
  [c[i], c[j]] = [c[j], c[i]];
  setChain(c);
}
export function toggleModule(i: number) {
  setChain(state.chain.map((it, k) => (k === i ? { ...it, on: !it.on } : it)));
}
export function resetModule(i: number) {
  const def = REGISTRY[state.chain[i]?.id];
  if (!def) return;
  setChain(state.chain.map((it, k) => (k === i ? { ...it, p: def.defaults() } : it)));
}
export function setParam(i: number, key: string, value: number) {
  const it = state.chain[i];
  if (!it) return;
  const p = { ...it.p, [key]: value };
  const chain = state.chain.slice();
  chain[i] = { ...it, p };
  setState({ chain });
  engine.setParams(i, p);
}
export function setBypass(on: boolean) { setState({ bypass: on }); engine.setBypass(on); }

/** Replace the chain with a preset's; unknown ids are skipped with a toast. */
export function loadPreset(p: Preset) {
  const known = p.chain.filter((c) => REGISTRY[c.id]);
  if (known.length < p.chain.length) toast('האפקט הזה יגיע בשלב הבא');
  setChain(known.map((c) => ({ id: c.id, on: c.on, p: { ...REGISTRY[c.id].defaults(), ...c.p } })));
}
export function savePreset(name: string) {
  const n = name.trim();
  if (!n) return;
  const presets = state.presets.filter((p) => p.name !== n);
  presets.push({ name: n, chain: state.chain.map((c) => ({ id: c.id, on: c.on, p: { ...c.p } })) });
  setState({ presets });
  toast('נשמר');
}
export function deletePreset(name: string) { setState({ presets: state.presets.filter((p) => p.name !== name) }); }

export function selectSource(source: SourceId) {
  if (!hasSource(source, state.book)) return;
  setState({ source });
}
export function selectChapter(book: string, chapter: number) {
  const source = hasSource(state.source, book) ? state.source : 'live';
  setState({ book, chapter, source, loop: null });
  engine.setLoop();
}
export function setLoop(loop: [number, number] | null) {
  setState({ loop });
  if (loop) engine.setLoop(loop[0], loop[1]); else engine.setLoop();
}

// keep the engine's chain in step with the restored state
engine.setChain(state.chain);

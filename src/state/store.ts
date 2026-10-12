import { useSyncExternalStore } from 'react';
import { engine } from '../audio/engine';
import { measureInWorker } from '../audio/render';
import { isRegion, printKey, printStats, type PrintMode } from '../dsp/modules/nr';
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
  analyzer: boolean;
  /** loudness modules: measured input LUFS per chain index ('busy' while measuring) */
  measures: Record<number, number | 'busy'>;
  toast: { msg: string; id: number } | null;
}

const KEY = 'narrator-studio:v1';
const PERSIST = ['chain', 'source', 'book', 'chapter', 'presets'] as const;

const DEFAULTS: State = {
  source: 'live', book: 'Genesis', chapter: 1, chain: [], presets: [], note: '', bypass: false,
  loop: null, zoom: 1, progress: null, error: null, loadedUrl: '', sheet: null, analyzer: false, measures: {}, toast: null,
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

/** Created on first run (the nr one resolves once Phase 2 adds the module). */
export const STARTER_PRESETS: Preset[] = [
  { name: 'ריק', chain: [] },
  { name: 'מסנן 95', chain: [{ id: 'hp', on: true, p: { freq: 95, order: 4 } }] },
  { name: 'שקט בהפסקות (א׳)', chain: [
    { id: 'hp', on: true, p: { freq: 95, order: 4 } },
    { id: 'gate', on: true, p: { thresh: -45, range: 12, attack: 2, hold: 80, release: 150 } },
  ] },
  { name: 'הפחתת רעש (ב׳ בקירוב)', chain: [
    { id: 'hp', on: true, p: { freq: 95, order: 4 } },
    { id: 'nr', on: true, p: { depth: 10, k: 1.5 } },
  ] },
];

const persisted = typeof localStorage === 'undefined' ? { _fresh: true } : readPersisted();
export const firstRun = !!persisted._fresh;
delete persisted._fresh;
let state: State = { ...DEFAULTS, ...persisted };
if (firstRun) state = { ...state, presets: STARTER_PRESETS };
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

function setChain(chain: ChainItem[]) { setState({ chain }); engine.setChain(chain, []); syncPrints(); syncLoudness(); }

// ---- loudness modules: measure what reaches them (prefix render in a worker), debounced + cached ----
const measureCache = new Map<string, number>();
let measureTimer: ReturnType<typeof setTimeout> | undefined;
export function syncLoudness() {
  clearTimeout(measureTimer);
  const idx = state.chain.map((c, i) => (c.id === 'loudness' && c.on ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) { if (Object.keys(state.measures).length) setState({ measures: {} }); return; }
  const url = state.loadedUrl;
  const keyOf = (i: number) => `${url}|${JSON.stringify(state.chain.slice(0, i).filter((c) => c.on))}`;
  const measures: Record<number, number | 'busy'> = {};
  for (const i of idx) {
    const hit = measureCache.get(keyOf(i));
    measures[i] = hit ?? 'busy';
    if (hit !== undefined) engine.setMeasured(i, hit);
  }
  setState({ measures });
  if (!idx.some((i) => measures[i] === 'busy')) return;
  measureTimer = setTimeout(async () => {
    const data = url ? engine.data(url) : null;
    if (!data) return;
    const chain = state.chain;
    for (const i of idx) {
      const key = keyOf(i);
      if (measureCache.has(key)) continue;
      try {
        const lufs = await measureInWorker(data, chain, i);
        measureCache.set(key, lufs);
        if (measureCache.size > 30) measureCache.delete(measureCache.keys().next().value as string);
      } catch { /* leave busy; next change retries */ }
    }
    if (state.chain === chain && state.loadedUrl === url) syncLoudness();
  }, 1200);
}

// ---- noise prints for nr modules (the worklet has no source, so the main thread computes them) ----
const printCache = new Map<string, Float32Array>();
/** Sends each nr module the print statistics of the loaded source (cached per url + print region). */
export function syncPrints() {
  const url = state.loadedUrl, data = url ? engine.data(url) : null;
  if (!data) return;
  state.chain.forEach((it, i) => {
    if (it.id !== 'nr') return;
    const mode: PrintMode = isRegion(it.p.print) ? it.p.print : 'auto';
    const key = `${url}|${printKey(mode)}`;
    let st = printCache.get(key);
    if (!st) {
      st = printStats(data, mode);
      printCache.set(key, st);
      if (printCache.size > 12) printCache.delete(printCache.keys().next().value as string);
    }
    engine.setPrint(i, st);
  });
}
export function setNrPrint(i: number, print: PrintMode) {
  setParam(i, 'print', print);
  syncPrints();
}

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
export function setParam(i: number, key: string, value: unknown) {
  const it = state.chain[i];
  if (!it) return;
  const p = { ...it.p, [key]: value };
  const chain = state.chain.slice();
  chain[i] = { ...it, p };
  setState({ chain });
  engine.setParams(i, p);
  if (state.chain.some((c, k) => c.id === 'loudness' && c.on && k > i)) syncLoudness();
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

// keep the engine's chain in step with the restored state; save the starters on first run
engine.setChain(state.chain);
if (firstRun) persist({ ...state, presets: [] });

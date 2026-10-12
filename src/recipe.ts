import { REGISTRY } from './dsp/registry';
import type { ChainItem } from './dsp/types';
import { SOURCES, bookByEnglish, type SourceId } from './sources';

export interface Recipe {
  v: 1;
  app: 'narrator-studio';
  created: string;
  source: SourceId;
  book: string;
  chapter: number;
  sr: 48000;
  note: string;
  chain: ChainItem[];
}

export interface RecipeState {
  source: SourceId; book: string; chapter: number; note?: string; chain: ChainItem[]; created?: string;
}

export function validate(obj: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const r = obj as Partial<Recipe> | null;
  if (!r || typeof r !== 'object') return { ok: false, errors: ['not an object'] };
  if (r.v !== 1) errors.push(`unsupported v: ${String(r.v)}`);
  if (r.sr !== undefined && r.sr !== 48000) errors.push(`sr must be 48000, got ${String(r.sr)}`);
  if (!r.source || !(r.source in SOURCES)) errors.push(`bad source: ${String(r.source)}`);
  const book = typeof r.book === 'string' ? bookByEnglish(r.book) : undefined;
  if (!book) errors.push(`unknown book: ${String(r.book)}`);
  else if (!Number.isInteger(r.chapter) || (r.chapter as number) < 1 || (r.chapter as number) > book.chapters)
    errors.push(`chapter out of range for ${book.english} (1..${book.chapters}): ${String(r.chapter)}`);
  if (!Array.isArray(r.chain)) errors.push('chain must be an array');
  else r.chain.forEach((it, i) => {
    if (!it || typeof it !== 'object') { errors.push(`chain[${i}] is not an object`); return; }
    if (!REGISTRY[it.id]) errors.push(`chain[${i}]: unknown id "${String(it.id)}"`);
    if (typeof it.on !== 'boolean') errors.push(`chain[${i}]: "on" must be boolean`);
    if (it.p !== undefined && (typeof it.p !== 'object' || it.p === null || Array.isArray(it.p)))
      errors.push(`chain[${i}]: "p" must be an object`);
  });
  return { ok: errors.length === 0, errors };
}

/** Builds the recipe object with keys in the contract's order. */
export function toRecipe(s: RecipeState): Recipe {
  return {
    v: 1,
    app: 'narrator-studio',
    created: s.created ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    source: s.source,
    book: s.book,
    chapter: s.chapter,
    sr: 48000,
    note: s.note ?? '',
    chain: s.chain.map((c) => ({ id: c.id, on: c.on, p: { ...c.p } })),
  };
}

export const serialize = (s: RecipeState): string => JSON.stringify(toRecipe(s), null, 2);

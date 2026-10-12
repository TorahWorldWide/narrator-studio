import { describe, it, expect } from 'vitest';
import { serialize, validate } from '../src/recipe';

const state = {
  source: 'live' as const, book: 'Genesis', chapter: 1, note: 'נסיון', created: '2026-10-12T18:04:11Z',
  chain: [
    { id: 'hp', on: true, p: { freq: 95, order: 4 } },
    { id: 'comp', on: false, p: { thresh: -18, ratio: 2, attack: 10, release: 120, knee: 6, makeup: 0 } },
  ],
};

describe('recipe', () => {
  it('round-trips with keys in contract order and 2-space indent', () => {
    const txt = serialize(state);
    const obj = JSON.parse(txt);
    expect(Object.keys(obj)).toEqual(['v', 'app', 'created', 'source', 'book', 'chapter', 'sr', 'note', 'chain']);
    expect(Object.keys(obj.chain[0])).toEqual(['id', 'on', 'p']);
    expect(txt.split('\n')[1]).toBe('  "v": 1,');
    expect(validate(obj)).toEqual({ ok: true, errors: [] });
    expect(serialize({ ...obj })).toBe(txt);
  });
  it('rejects unknown id, bad source, chapter out of range, wrong v', () => {
    const bad = { ...JSON.parse(serialize(state)), v: 2, source: 'xx', chapter: 51 };
    bad.chain.push({ id: 'wat', on: true, p: {} });
    const r = validate(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join('|')).toMatch(/unsupported v/);
    expect(r.errors.join('|')).toMatch(/bad source/);
    expect(r.errors.join('|')).toMatch(/chapter out of range/);
    expect(r.errors.join('|')).toMatch(/unknown id "wat"/);
  });
});

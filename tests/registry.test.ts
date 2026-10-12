import { describe, it, expect } from 'vitest';
import { GROUPS, groupOf } from '../src/dsp/groups';
import { MODULES, REGISTRY } from '../src/dsp/registry';

describe('registry ↔ groups', () => {
  it('every grouped id is a real module and every module is in exactly one group', () => {
    const grouped = GROUPS.flatMap((g) => g.modules);
    for (const id of grouped) expect(REGISTRY[id], id).toBeTruthy();
    for (const id of Object.keys(REGISTRY)) expect(grouped.filter((g) => g === id).length, id).toBe(1);
    expect(MODULES.length).toBe(Object.keys(REGISTRY).length);
    for (const m of MODULES) expect(groupOf(m.id)).toBeTruthy();
  });
  it('every module has Hebrew names, a blurb, defaults covering its params, and params inside their ranges', () => {
    for (const m of MODULES) {
      expect(m.he && m.en && m.blurb, m.id).toBeTruthy();
      const d = m.defaults();
      for (const p of m.params) {
        expect(typeof d[p.key], `${m.id}.${p.key}`).toBe('number');
        expect(d[p.key] >= p.min && d[p.key] <= p.max, `${m.id}.${p.key}`).toBe(true);
        expect(p.def, `${m.id}.${p.key}`).toBe(d[p.key]);
      }
    }
  });
});

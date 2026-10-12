import type { ModuleDef } from '../types';
import { ButterProc } from './hp';

interface FilterP { freq: number; order: number }

export const lp: ModuleDef<FilterP> = {
  id: 'lp', he: 'מסנן גבוהים', en: 'Low-pass',
  blurb: 'מרכך שריקות וצליל חד מעל התדר שבוחרים',
  params: [
    { key: 'freq', he: 'תדר', en: 'Freq', min: 1000, max: 20000, def: 16000, step: 10, unit: 'Hz', scale: 'log' },
    { key: 'order', he: 'חדות', en: 'Order', min: 2, max: 8, def: 4, step: 2, unit: '', scale: 'lin' },
  ],
  defaults: () => ({ freq: 16000, order: 4 }),
  create: (sr) => new ButterProc(sr, 'lp', { freq: 16000, order: 4 }),
};

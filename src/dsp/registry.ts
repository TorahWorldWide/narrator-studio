import type { ModuleDef } from './types';
import { gain } from './modules/gain';
import { hp } from './modules/hp';
import { lp } from './modules/lp';
import { eq } from './modules/eq';
import { gate } from './modules/gate';
import { comp } from './modules/comp';
import { limiter } from './modules/limiter';
import { nr } from './modules/nr';
import { hum } from './modules/hum';
import { deess } from './modules/deess';
import { sat } from './modules/sat';
import { delay } from './modules/delay';
import { reverb } from './modules/reverb';
import { pitch } from './modules/pitch';

import { GROUPS } from './groups';

const ALL: ModuleDef[] = [gain, hp, lp, eq, gate, comp, limiter, nr, hum, deess, sat, pitch, reverb, delay];
export const REGISTRY: Record<string, ModuleDef> = Object.fromEntries(ALL.map((m) => [m.id, m]));
/** Ordered list for the "+" sheet: group order, then the order inside each group. */
export const MODULES: ModuleDef[] = GROUPS.flatMap((g) => g.modules.map((id) => REGISTRY[id]).filter(Boolean));
export const moduleDef = (id: string): ModuleDef | undefined => REGISTRY[id];

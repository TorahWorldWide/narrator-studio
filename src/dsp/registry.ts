import type { ModuleDef } from './types';
import { gain } from './modules/gain';
import { hp } from './modules/hp';
import { lp } from './modules/lp';
import { eq } from './modules/eq';
import { gate } from './modules/gate';

/** Ordered list for the "+" sheet. */
export const MODULES: ModuleDef[] = [gain, hp, lp, eq, gate];
export const REGISTRY: Record<string, ModuleDef> = Object.fromEntries(MODULES.map((m) => [m.id, m]));
export const moduleDef = (id: string): ModuleDef | undefined => REGISTRY[id];

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

import { chorus } from './modules/chorus';
import { phaser } from './modules/phaser';
import { lofi } from './modules/lofi';
import { tremolo } from './modules/tremolo';
import { robot } from './modules/robot';
import { geq } from './modules/geq';
import { dyneq } from './modules/dyneq';
import { tilt } from './modules/tilt';
import { exciter } from './modules/exciter';
import { expander } from './modules/expander';
import { clipper } from './modules/clipper';
import { transient } from './modules/transient';
import { mbcomp } from './modules/mbcomp';
import { rider } from './modules/rider';
import { loudness } from './modules/loudness';
import { declick } from './modules/declick';
import { deplosive } from './modules/deplosive';
import { debreath } from './modules/debreath';
import { ainr } from './modules/ainr';
import { dereverb } from './modules/dereverb';
import { room } from './modules/room';
import { GROUPS } from './groups';

const ALL: ModuleDef[] = [gain, hp, lp, eq, gate, comp, limiter, nr, hum, deess, sat, pitch, reverb, delay,
  chorus, phaser, lofi, tremolo, robot, geq, dyneq, tilt, exciter,
  expander, clipper, transient, mbcomp, rider, loudness,
  declick, deplosive, debreath, ainr, dereverb, room];
export const REGISTRY: Record<string, ModuleDef> = Object.fromEntries(ALL.map((m) => [m.id, m]));
/** Ordered list for the "+" sheet: group order, then the order inside each group. */
export const MODULES: ModuleDef[] = GROUPS.flatMap((g) => g.modules.map((id) => REGISTRY[id]).filter(Boolean));
export const moduleDef = (id: string): ModuleDef | undefined => REGISTRY[id];

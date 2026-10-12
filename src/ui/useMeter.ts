import { useEffect, useState } from 'react';
import { engine, type Meter } from '../audio/engine';

const EMPTY: Meter = { inPeak: 0, outPeak: 0, gr: [] };

/** Latest meter message from the worklet (≈ 23 per second). */
export function useMeter(): Meter {
  const [m, setM] = useState<Meter>(EMPTY);
  useEffect(() => engine.onMeter(setM), []);
  return m;
}

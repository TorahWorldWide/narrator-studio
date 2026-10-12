import { useRef } from 'react';
import type { ParamDef } from '../dsp/types';
import { clampStep, formatValue, fromNorm, toNorm, unitLabel } from './format';

interface Props { def: ParamDef; value: number; onChange: (v: number) => void; format?: (v: number) => string }

const SIZE = 56, R = 22, C = SIZE / 2, START = 135, SWEEP = 270;
const pt = (deg: number) => { const a = (deg * Math.PI) / 180; return `${(C + R * Math.cos(a)).toFixed(2)} ${(C + R * Math.sin(a)).toFixed(2)}`; };
const arc = (from: number, to: number) => `M ${pt(from)} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${pt(to)}`;

/** 270° knob: vertical drag (150 px = full range), double-tap = default, tap on the value = type it. */
export default function Knob({ def, value, onChange, format }: Props) {
  const drag = useRef<{ y: number; n: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const n = toNorm(def, value);
  const end = START + SWEEP * n;
  const text = format ? format(value) : formatValue(def, value);

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, n, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    const v = fromNorm(def, d.n + dy / 150);
    if (v !== value) onChange(v);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const now = performance.now();
    if (now - lastTap.current < 320) { lastTap.current = 0; onChange(def.def); }
    else lastTap.current = now;
  };
  const typeIt = () => {
    const s = prompt(`${def.he} (${def.min}–${def.max} ${unitLabel[def.unit]})`, String(value));
    if (s === null) return;
    const v = Number(s.replace(',', '.'));
    if (Number.isFinite(v)) onChange(clampStep(def, v));
  };

  return (
    <div className="knob">
      <svg
        width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="slider" tabIndex={0}
        aria-label={def.he} aria-valuemin={def.min} aria-valuemax={def.max} aria-valuenow={value}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(fromNorm(def, n + 0.01));
          if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(fromNorm(def, n - 0.01));
        }}
      >
        <path d={arc(START, START + SWEEP)} className="knob-track" />
        {n > 0.002 && <path d={arc(START, end)} className="knob-val" />}
        <line x1={C} y1={C} x2={C + (R - 6) * Math.cos((end * Math.PI) / 180)} y2={C + (R - 6) * Math.sin((end * Math.PI) / 180)} className="knob-ptr" />
      </svg>
      <button type="button" className="knob-value" onClick={typeIt}>
        {text}{unitLabel[def.unit] && <span className="knob-unit"> {unitLabel[def.unit]}</span>}
      </button>
      <div className="knob-label">{def.he}</div>
    </div>
  );
}

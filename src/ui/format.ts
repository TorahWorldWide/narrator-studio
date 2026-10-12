import type { ParamDef } from '../dsp/types';

const decimals = (step: number) => { const s = String(step); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };

export function clampStep(def: ParamDef, v: number) {
  const c = Math.min(def.max, Math.max(def.min, v));
  const s = def.step > 0 ? Math.round(c / def.step) * def.step : c;
  return Number(Math.min(def.max, Math.max(def.min, s)).toFixed(decimals(def.step)));
}
export function toNorm(def: ParamDef, v: number) {
  const n = def.scale === 'log' && def.min > 0
    ? Math.log(v / def.min) / Math.log(def.max / def.min)
    : (v - def.min) / (def.max - def.min);
  return Math.min(1, Math.max(0, n));
}
export function fromNorm(def: ParamDef, n: number) {
  const k = Math.min(1, Math.max(0, n));
  const v = def.scale === 'log' && def.min > 0 ? def.min * Math.pow(def.max / def.min, k) : def.min + k * (def.max - def.min);
  return clampStep(def, v);
}
export function formatValue(def: ParamDef, v: number) {
  if (def.unit === 'Hz' && v >= 1000) return `${Number((v / 1000).toFixed(v >= 10000 ? 1 : 2))}k`;
  const d = Math.min(decimals(def.step), Math.abs(v) >= 100 ? 0 : 2);
  const s = Number(v.toFixed(d)).toString();
  return def.unit === 'x' ? `${s}:1` : def.unit === '%' ? `${s}%` : s;
}
export const unitLabel: Record<ParamDef['unit'], string> = { '': '', dB: 'dB', Hz: 'Hz', ms: 'ms', s: 's', '%': '', st: 'st', x: '' };

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
};
export const fmtDb = (lin: number) => (lin > 1e-5 ? (20 * Math.log10(lin)).toFixed(1) : '−∞');

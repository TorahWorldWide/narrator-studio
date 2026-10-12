/** RBJ Audio-EQ-Cookbook biquads, transposed direct form II, coefficients normalised by a0. */
export interface Coefs { b0: number; b1: number; b2: number; a1: number; a2: number }

const norm = (b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Coefs =>
  ({ b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 });

function w(sr: number, f: number, q: number) {
  const fc = Math.min(Math.max(f, 1), sr * 0.4999);
  const w0 = (2 * Math.PI * fc) / sr;
  return { cos: Math.cos(w0), alpha: Math.sin(w0) / (2 * q) };
}

export function lowpass(sr: number, f: number, q: number): Coefs {
  const { cos, alpha } = w(sr, f, q);
  return norm((1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}
export function highpass(sr: number, f: number, q: number): Coefs {
  const { cos, alpha } = w(sr, f, q);
  return norm((1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha);
}
export function peaking(sr: number, f: number, q: number, db: number): Coefs {
  const { cos, alpha } = w(sr, f, q);
  const A = Math.pow(10, db / 40);
  return norm(1 + alpha * A, -2 * cos, 1 - alpha * A, 1 + alpha / A, -2 * cos, 1 - alpha / A);
}
export function lowshelf(sr: number, f: number, q: number, db: number): Coefs {
  const { cos, alpha } = w(sr, f, q);
  const A = Math.pow(10, db / 40), sq = 2 * Math.sqrt(A) * alpha;
  return norm(
    A * ((A + 1) - (A - 1) * cos + sq), 2 * A * ((A - 1) - (A + 1) * cos), A * ((A + 1) - (A - 1) * cos - sq),
    (A + 1) + (A - 1) * cos + sq, -2 * ((A - 1) + (A + 1) * cos), (A + 1) + (A - 1) * cos - sq);
}
export function highshelf(sr: number, f: number, q: number, db: number): Coefs {
  const { cos, alpha } = w(sr, f, q);
  const A = Math.pow(10, db / 40), sq = 2 * Math.sqrt(A) * alpha;
  return norm(
    A * ((A + 1) + (A - 1) * cos + sq), -2 * A * ((A - 1) + (A + 1) * cos), A * ((A + 1) + (A - 1) * cos - sq),
    (A + 1) - (A - 1) * cos + sq, 2 * ((A - 1) - (A + 1) * cos), (A + 1) - (A - 1) * cos - sq);
}

export class Biquad {
  c: Coefs; z1 = 0; z2 = 0;
  constructor(c: Coefs) { this.c = c; }
  set(c: Coefs) { this.c = c; }
  reset() { this.z1 = 0; this.z2 = 0; }
  process(x: Float32Array, y: Float32Array) {
    const { b0, b1, b2, a1, a2 } = this.c;
    let z1 = this.z1, z2 = this.z2;
    for (let i = 0; i < x.length; i++) {
      const xi = x[i];
      const yi = b0 * xi + z1;
      z1 = b1 * xi - a1 * yi + z2;
      z2 = b2 * xi - a2 * yi;
      y[i] = yi;
    }
    this.z1 = z1; this.z2 = z2;
  }
}

/** Butterworth section Qs per order (order/2 cascaded 2nd-order sections). */
export const BUTTER_Q: Record<number, number[]> = {
  2: [0.7071],
  4: [0.5412, 1.3066],
  6: [0.5176, 0.7071, 1.9319],
  8: [0.5098, 0.6013, 0.9, 2.5629],
};
export const butterOrder = (o: number) => (o <= 2 ? 2 : o <= 4 ? 4 : o <= 6 ? 6 : 8);

/** A chain of biquads processed in series (first x→y, then y→y in place). */
export class Cascade {
  sections: Biquad[] = [];
  /** Replace coefficients; keeps filter state when the section count is unchanged. */
  setAll(cs: Coefs[]) {
    if (cs.length !== this.sections.length) this.sections = cs.map((c) => new Biquad(c));
    else cs.forEach((c, i) => this.sections[i].set(c));
  }
  reset() { this.sections.forEach((s) => s.reset()); }
  process(x: Float32Array, y: Float32Array) {
    if (this.sections.length === 0) { if (x !== y) y.set(x); return; }
    let src = x;
    for (const s of this.sections) { s.process(src, y); src = y; }
  }
}
